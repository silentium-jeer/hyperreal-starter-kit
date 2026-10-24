// Content pipeline: turns a model file the game code imports into a cooked content container that a running
// VibeGameEngine mounts. Only files imported by the game code are built (dev/vite/contentAssetsPlugin.mjs asks
// for them); nothing is picked up from a folder. Every step is a stock engine tool, run the way BuildCookRun
// runs it for a DLC plugin:
//   decode   - gltf-transform removes what Interchange cannot read (content/decode.mjs)
//   import   - resident VgeContentService: Interchange import, Nanite on, save into the VgeLive plugin
//   cook     - stock CookCommandlet (-dlcname=VgeLive -basedonreleaseversion=<release>) in a standby process
//   package  - UnrealPak -CreateMultiple (.pak) and UnrealPak -CreateDLCContainer (.utoc/.ucas)
// An asset pack added from Fab (content/fab.mjs) is cooked and packaged the same way into a container of its own
// (buildPack below).
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { engine, runtimeDir } from '../tools/engine.mjs';
import { createStandbyCooker } from './cooker.mjs';
import { assetName, createDecoder } from './decode.mjs';
import { createContentService } from './service.mjs';

const { editorCmd: EDITOR_CMD, unrealPak: UNREAL_PAK } = engine();
const PLUGIN = 'VgeLive';
// Cooked files that go into the IoStore container (shader info files stay metadata, as in UAT staging).
const CONTAINER_FILES = /\.(uasset|umap|uexp|ubulk|uptnl|ushaderbytecode)$/i;
// live-state.json layout; state written by another layout is dropped together with the content it describes.
const STATE_VERSION = 2;

export function createContentPipeline({ projectDir, release = 'dev', log = console.log }) {
  const project = resolve(projectDir, 'VibeGameEngine.uproject');
  const pluginDir = resolve(projectDir, 'Plugins', PLUGIN);
  const contentDir = join(pluginDir, 'Content');
  const cookedRoot = join(pluginDir, 'Saved', 'Cooked', 'Windows');
  const cookedPlugin = join(cookedRoot, 'VibeGameEngine', 'Plugins', PLUGIN);
  const workDir = join(pluginDir, 'Saved', 'Pipeline');
  const outDir = join(pluginDir, 'Saved', 'Containers');
  const statePath = join(pluginDir, 'Saved', 'live-state.json');
  mkdirSync(workDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  let state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null;
  if (state?.version !== STATE_VERSION) {
    // Read before the service starts, so no process holds the packages being removed. Build numbers keep
    // counting: a running game may still have older containers mounted under their names.
    for (const name of existsSync(contentDir) ? readdirSync(contentDir) : []) {
      if (name !== '.keep') rmSync(join(contentDir, name), { recursive: true, force: true });
    }
    // Asset packs live in the project's Content, not in the plugin: their containers stay valid.
    state = { version: STATE_VERSION, build: state?.build ?? 0, assets: {}, container: null, packs: state?.packs ?? {} };
  }
  const saveState = () => writeFileSync(statePath, JSON.stringify(state, null, 2));

  const decode = createDecoder();
  // Import and deletion run inside the resident service; the cook stays an external commandlet,
  // which is how the editor itself cooks since 5.7 (UnrealEdEngine.cpp: in-editor cook is deprecated).
  const service = createContentService({ editorCmd: EDITOR_CMD, project, logFile: join(pluginDir, 'Saved', 'content-service.log'), log });
  // That external cook is started ahead of time and waits in standby, so its engine startup is not on
  // the path of an asset edit.
  const cooker = createStandbyCooker({
    editorCmd: EDITOR_CMD,
    project,
    cookArgs: ['-TargetPlatform=Windows', '-unversioned', '-SkipZenStore', `-dlcname=${PLUGIN}`, `-basedonreleaseversion=${release}`],
    logDir: workDir,
    log,
  });

  function run(label, exe, args, logFile) {
    return new Promise((resolvePromise, reject) => {
      const started = Date.now();
      const child = spawn(exe, args, { windowsHide: true });
      let output = '';
      child.stdout.on('data', (d) => (output += d));
      child.stderr.on('data', (d) => (output += d));
      child.on('error', reject);
      child.on('close', (code) => {
        writeFileSync(logFile, output);
        const seconds = (Date.now() - started) / 1000;
        if (code === 0) resolvePromise(seconds);
        else reject(new Error(`${label} failed with exit code ${code}; log: ${logFile}\n${output.split('\n').filter((l) => /Error|error:/.test(l)).slice(0, 10).join('\n')}`));
      });
    });
  }

  function listFiles(dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? listFiles(full) : [full];
    });
  }

  // Path inside the container, the same mount-relative form the staged DLC uses.
  const mountPath = (file) => `../../../VibeGameEngine/Plugins/${PLUGIN}/${relative(cookedPlugin, file).replaceAll('\\', '/')}`;

  // `key` is the file's path relative to the dev folder, the identity the game code's import carries.
  async function build(sourcePath, key) {
    const name = assetName(sourcePath);
    const buildId = ++state.build;
    const tag = `b${String(buildId).padStart(4, '0')}`;
    const timings = {};
    const logs = join(workDir, tag);
    mkdirSync(logs, { recursive: true });

    const t0 = Date.now();
    const decoded = await decode(sourcePath, join(logs, `${name}.glb`));
    timings.decode = (Date.now() - t0) / 1000;

    // Each version lives in its own content path, so a new version never collides with a mounted one.
    const previous = state.assets[key];
    const dest = `/${PLUGIN}/${name}_${tag}`;
    let t = Date.now();
    const imported = await service.call('import', { source: decoded.file, dest });
    writeFileSync(join(logs, 'import.json'), JSON.stringify(imported, null, 2));
    if (previous) await service.call('delete', { path: previous.dest });
    timings.import = (Date.now() - t) / 1000;

    rmSync(cookedRoot, { recursive: true, force: true });
    const cooked = await cooker.cook();
    copyFileSync(cooked.logFile, join(logs, 'cook.log'));
    timings.cook = cooked.seconds;

    const container = `${PLUGIN}-${tag}`;
    const pak = join(outDir, `${container}.pak`);
    // UAT writes the project's crypto settings next to the cooked metadata while staging; a DLC uses the
    // same settings as the base game, so take the copy the base staging wrote.
    const crypto = join(cookedPlugin, 'Metadata', 'Crypto.json');
    copyFileSync(join(runtimeDir(), 'Saved', 'Cooked', 'Windows', 'VibeGameEngine', 'Metadata', 'Crypto.json'), crypto);
    // Loose cook: the package store manifest stands in for the Zen project store, as in UAT's non-Zen staging.
    const manifestFile = join(cookedPlugin, 'Metadata', 'packagestore.manifest');
    const packaged = listFiles(join(cookedPlugin, 'Content')).filter((f) => CONTAINER_FILES.test(f));
    writeFileSync(join(logs, 'PakList.txt'), `"${join(cookedPlugin, 'AssetRegistry.bin')}" "${mountPath(join(cookedPlugin, 'AssetRegistry.bin'))}" -compress`);
    writeFileSync(join(logs, 'PakListIoStore.txt'), packaged.map((f) => `"${f}" "${mountPath(f)}"${f.endsWith('.ushaderbytecode') ? '' : ' -compress'}`).join('\n'));
    writeFileSync(join(logs, 'PakCommands.txt'), `"${pak}" -create="${join(logs, 'PakList.txt')}"`);
    writeFileSync(join(logs, 'IoStoreCommands.txt'), `-Output="${join(outDir, `${container}.utoc`)}" -ContainerName=${container} -ResponseFile="${join(logs, 'PakListIoStore.txt')}"`);
    const compression = ['-patchpaddingalign=2048', '-compressionformats=Oodle', '-compresslevel=4', '-compressmethod=Kraken'];
    timings.pak = await run('pak', UNREAL_PAK, [project, `-cryptokeys=${crypto}`, '-unattended', ...compression, '-platform=Windows', `-CreateMultiple=${join(logs, 'PakCommands.txt')}`], join(logs, 'pak.log'));
    timings.iostore = await run('iostore', UNREAL_PAK, [project, project, `-CreateDLCContainer=${join(pluginDir, `${PLUGIN}.uplugin`)}`, `-PackageStoreManifest=${manifestFile}`, `-ScriptObjects=${join(cookedPlugin, 'Metadata', 'scriptobjects.bin')}`, `-CookedDirectory=${cookedRoot}`, `-Commands=${join(logs, 'IoStoreCommands.txt')}`, ...compression, `-cryptokeys=${crypto}`, '-compressionMinBytesSaved=1024', '-compressionMinPercentSaved=5', '-WriteBackMetadataToAssetRegistry=Disabled', '-platform=Windows', `-BasedOnReleaseVersionPath=${resolve(projectDir, 'Releases', release, 'Windows')}`, '-unattended'], join(logs, 'iostore.log'));

    state.assets[key] = { source: sourcePath, sourceMtimeMs: statSync(sourcePath).mtimeMs, dest, objects: imported.objects, build: buildId, decoded: decoded.decoded };
    state.container = { pak: pak.replaceAll('\\', '/'), plugin: PLUGIN, build: buildId };
    saveState();
    timings.total = (Date.now() - t0) / 1000;
    log(`[content] ${key} -> ${container} in ${timings.total.toFixed(1)} s ${JSON.stringify(timings)}`);
    return { key, timings, manifest: manifest() };
  }

  // What a runtime needs: the newest container (it holds every built asset) and, per imported file, its objects;
  // and the container of each asset pack.
  function manifest() {
    const packs = state.packs ?? {};
    if (!state.container && !Object.keys(packs).length) return null;
    const assets = Object.fromEntries(Object.entries(state.assets).map(([key, a]) => [key, { build: a.build, objects: a.objects }]));
    return { pak: null, plugin: PLUGIN, build: state.build, ...state.container, assets, packs };
  }

  // An asset pack in the project's Content/<name> (added from Fab, dev/content/fab.mjs): its packages keep their
  // /Game/<name>/ paths, which their references to each other use. It is cooked as DLC against the base release like
  // live content, with its folder given to the cook (-COOKDIR, CollectFilesToCook), into a container of its own that
  // holds only the pack's packages, so a model edit never re-cooks gigabytes of pack. The shader library the cook
  // writes under the DLC's name is renamed after the pack: an IoStore library is found by its name
  // (FIoStoreShaderCodeArchive::Create), so each pack's library is its own and MountContent opens it by that name.
  async function buildPack(name) {
    const packDir = resolve(projectDir, 'Content', name);
    if (!existsSync(packDir)) throw new Error(`no asset pack at ${packDir}`);
    const buildId = ++state.build;
    const tag = `b${String(buildId).padStart(4, '0')}`;
    const logs = join(workDir, `${tag}-${name}`);
    mkdirSync(logs, { recursive: true });
    const t0 = Date.now();
    const timings = {};

    rmSync(cookedRoot, { recursive: true, force: true });
    const cooked = await cooker.cook({ args: [`-COOKDIR="${packDir}"`], scan: [`/Game/${name}/`] });
    copyFileSync(cooked.logFile, join(logs, 'cook.log'));
    timings.cook = cooked.seconds;

    // A DLC cook writes the project's packages under the project's name, beside the plugin's.
    const cookedPack = join(cookedRoot, 'VibeGameEngine', 'Content', name);
    const packaged = listFiles(cookedPack).filter((f) => CONTAINER_FILES.test(f));
    if (!packaged.length) throw new Error(`the cook wrote nothing for /Game/${name}; log: ${join(logs, 'cook.log')}`);
    const shaderLibrary = `VgePack${name.replace(/[^A-Za-z0-9]/g, '')}${tag}`;
    let library = null;
    for (const file of listFiles(join(cookedPlugin, 'Content'))) {
      const base = file.replace(/^.*[\\/]/, '');
      const renamed = base.replace(`-${PLUGIN}-`, `-${shaderLibrary}-`);
      if (renamed === base || !/^(ShaderArchive|ShaderAssetInfo)-/.test(base)) continue;
      renameSync(file, join(cookedPlugin, 'Content', renamed));
      if (renamed.endsWith('.ushaderbytecode')) library = join(cookedPlugin, 'Content', renamed);
    }

    const container = `Pack${name.replace(/[^A-Za-z0-9]/g, '')}-${tag}`;
    const pak = join(outDir, `${container}.pak`);
    const crypto = join(cookedPlugin, 'Metadata', 'Crypto.json');
    copyFileSync(join(runtimeDir(), 'Saved', 'Cooked', 'Windows', 'VibeGameEngine', 'Metadata', 'Crypto.json'), crypto);
    const manifestFile = join(cookedPlugin, 'Metadata', 'packagestore.manifest');
    // The .pak itself carries only a note of what the container is; the packages go into its IoStore container.
    const note = join(logs, 'pack.json');
    writeFileSync(note, JSON.stringify({ pack: name, build: buildId, shaderLibrary: library ? shaderLibrary : '' }, null, 2));
    const projectMount = (file) => `../../../VibeGameEngine/${relative(join(cookedRoot, 'VibeGameEngine'), file).replaceAll('\\', '/')}`;
    const ioStoreFiles = [...packaged.map((f) => `"${f}" "${projectMount(f)}" -compress`)];
    if (library) ioStoreFiles.push(`"${library}" "${mountPath(library)}"`);
    writeFileSync(join(logs, 'PakList.txt'), `"${note}" "../../../VibeGameEngine/Plugins/${PLUGIN}/Packs/${name}/pack.json" -compress`);
    writeFileSync(join(logs, 'PakListIoStore.txt'), ioStoreFiles.join('\n'));
    writeFileSync(join(logs, 'PakCommands.txt'), `"${pak}" -create="${join(logs, 'PakList.txt')}"`);
    writeFileSync(join(logs, 'IoStoreCommands.txt'), `-Output="${join(outDir, `${container}.utoc`)}" -ContainerName=${container} -ResponseFile="${join(logs, 'PakListIoStore.txt')}"`);
    const compression = ['-patchpaddingalign=2048', '-compressionformats=Oodle', '-compresslevel=4', '-compressmethod=Kraken'];
    timings.pak = await run('pak', UNREAL_PAK, [project, `-cryptokeys=${crypto}`, '-unattended', ...compression, '-platform=Windows', `-CreateMultiple=${join(logs, 'PakCommands.txt')}`], join(logs, 'pak.log'));
    timings.iostore = await run('iostore', UNREAL_PAK, [project, project, `-CreateDLCContainer=${join(pluginDir, `${PLUGIN}.uplugin`)}`, `-PackageStoreManifest=${manifestFile}`, `-ScriptObjects=${join(cookedPlugin, 'Metadata', 'scriptobjects.bin')}`, `-CookedDirectory=${cookedRoot}`, `-Commands=${join(logs, 'IoStoreCommands.txt')}`, ...compression, `-cryptokeys=${crypto}`, '-compressionMinBytesSaved=1024', '-compressionMinPercentSaved=5', '-WriteBackMetadataToAssetRegistry=Disabled', '-platform=Windows', `-BasedOnReleaseVersionPath=${resolve(projectDir, 'Releases', release, 'Windows')}`, '-unattended'], join(logs, 'iostore.log'));

    state.packs = { ...state.packs, [name]: { name, pak: pak.replaceAll('\\', '/'), shaderLibrary: library ? shaderLibrary : '', build: buildId, packages: packaged.length } };
    saveState();
    timings.total = (Date.now() - t0) / 1000;
    log(`[content] pack ${name} -> ${container} (${packaged.length} files) in ${timings.total.toFixed(1)} s ${JSON.stringify(timings)}`);
    return { name, timings, manifest: manifest() };
  }

  // One build at a time; a file saved again while building is rebuilt once afterwards.
  let queue = Promise.resolve();
  const pending = new Set();
  function schedule(id, work, onDone) {
    if (pending.has(id)) return;
    pending.add(id);
    queue = queue.then(async () => {
      pending.delete(id);
      try {
        onDone(null, await work());
      } catch (err) {
        onDone(err);
      }
    });
  }
  const enqueue = (sourcePath, key, onDone) => schedule(key, () => build(sourcePath, key), onDone);
  const enqueuePack = (name, onDone) => schedule(`pack:${name}`, () => buildPack(name), onDone);

  // True when the file has no build yet or changed since its last one.
  const isStale = (sourcePath, key) => state.assets[key]?.sourceMtimeMs !== statSync(sourcePath).mtimeMs;

  return {
    enqueue,
    enqueuePack,
    isStale,
    manifest,
    // The resident content service, for other work that runs in it (dev/content/fab.mjs).
    service,
    startService: () => {
      service.start();
      cooker.ensure();
    },
    stopService: () => {
      service.stop();
      cooker.stop();
    },
  };
}
