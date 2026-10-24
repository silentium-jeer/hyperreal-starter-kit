// Fab: the kit's side of the Fab window (shell/src/FabWindow.cpp). The window gives the Fab website the engine Fab
// plugin's JavaScript API (window.ue.fab, UFabBrowserApi); what the plugin does in the editor for those calls
// (Engine/Plugins/Fab/Source/Fab/Private/FabBrowserApi.cpp) is done here for the kit:
//   getauthtoken getrefreshtoken login logout   the content service signs in with the plugin's EOS product (VgeFab)
//   addtoproject, an Unreal Engine asset pack   its build (BuildPatchServices manifest and chunks) goes into the
//                                               project's Content/<Pack> (PackImportWorkflow), then into a content
//                                               container of its own that every game mounts (pipeline buildPack); the
//                                               game code loads it by path, /Game/<Pack>/...
//   addtoproject, a glTF / GLB / FBX file       downloaded and unpacked (GenericImportWorkflow) into
//                                               src/shared/assets/fab/<Name>, and built by the content pipeline like
//                                               any model file the game code imports
//   installtoproject installtoengine            a plugin's build goes into Plugins/Marketplace/<Name>
//                                               (PluginInstallWorkflow), then the runtime is built for the kit's
//                                               sources with it (npm run build:cpp); the kit never changes the engine
//                                               install, so a plugin "for the engine" goes into the project too
// What arrives from Fab is licensed to the user, not to the kit's repository: each folder it lands in is ignored by git.
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline as streamPipeline } from 'node:stream/promises';
import { engine, engineVersion } from '../tools/engine.mjs';

// Where model files from Fab land, relative to the dev folder.
const MODELS_DIR = join('src', 'shared', 'assets', 'fab');

// A folder git leaves alone (what Fab delivers is the user's, under Fab's licence).
function ignoreFolder(dir) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, '.gitignore'), '# Added from Fab (dev/content/fab.mjs): licensed to the user, not part of the repository.\n*\n');
}

const listFiles = (dir) =>
  existsSync(dir) ? readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? listFiles(join(dir, name)) : [join(dir, name)])) : [];

// FAssetUtils::SanitizeFolderName: a folder name from a listing's title.
const folderName = (text) => text.replace(/[^A-Za-z0-9_\- ]+/g, '').trim().replace(/\s+/g, '_') || 'Asset';

// A field of the metadata struct whatever its case (the engine's binding lowercases struct fields).
function field(metadata, name) {
  const key = Object.keys(metadata ?? {}).find((k) => k.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : metadata[key];
}

// `notify(entry)` tells the user how an install goes: the shell page shows it (ui/shell/FabNotices.tsx).
export function createFab({ projectDir, devDir, pipeline, broadcast, notify = () => {}, log = console.log }) {
  const fabDir = join(projectDir, 'Saved', 'Fab');
  const settingsFile = join(fabDir, 'settings.json');
  const installsFile = join(fabDir, 'installs.json');
  mkdirSync(fabDir, { recursive: true });
  const service = pipeline.service;

  // Every install from the Fab window, for the agent's `node tools/fab.mjs installs`: what it is, how far, where.
  const installs = existsSync(installsFile) ? JSON.parse(readFileSync(installsFile, 'utf8')) : {};
  const saveInstalls = () => writeFileSync(installsFile, JSON.stringify(installs, null, 2));

  // UFabBrowserApi::GetApiVersion: the engine's version, the plugin's API and version, the platform.
  function apiVersion() {
    const version = engineVersion(engine().root);
    const plugin = JSON.parse(readFileSync(join(engine().root, 'Engine', 'Plugins', 'Fab', 'Fab.uplugin'), 'utf8'));
    return { ue: `${version.major}.${version.minor}`, api: '1.1.0', pluginversion: plugin.VersionName, platform: 'Windows', supportedfeatures: { banners: true } };
  }

  // UFabSettings' defaults: glTF, medium quality; the page changes the quality tier.
  function settings() {
    return { preferredformat: 'gltf', preferredquality: 'medium', ...(existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, 'utf8')) : {}) };
  }

  // A pack that is in the project's Content/<pack> already, or is copied there from a folder that holds
  // Content/<pack> (the Epic Games Launcher's download of it, VaultCache/<Name>/data): its container is built and
  // mounted as after Add to Project.
  async function addPack(pack, from) {
    if (from) {
      const source = join(from, 'Content', pack);
      if (!existsSync(source)) throw new Error(`no Content/${pack} in ${from}`);
      cpSync(source, join(projectDir, 'Content', pack), { recursive: true });
    }
    if (!existsSync(join(projectDir, 'Content', pack))) throw new Error(`no asset pack in Content/${pack}`);
    ignoreFolder(join(projectDir, 'Content', pack));
    const entry = { id: `pack:${pack}`, name: pack, state: 'started', progress: { stage: 'cooking' } };
    notify(entry);
    try {
      const built = await new Promise((resolvePromise, reject) => pipeline.enqueuePack(pack, (err, value) => (err ? reject(err) : resolvePromise(value))));
      broadcast(built.manifest);
      Object.assign(entry, { state: 'done', result: { kind: 'pack', pack, contentPath: `/Game/${pack}/`, container: built.manifest.packs[pack].pak } });
      return entry.result;
    } catch (err) {
      Object.assign(entry, { state: 'failed', error: err.message });
      throw err;
    } finally {
      notify(entry);
    }
  }

  async function installPack(entry, downloadUrl, baseUrls, progress) {
    const result = await service.call(
      'fab-install',
      { kind: 'pack', manifestUrl: downloadUrl, baseUrls, installDir: projectDir, stagingDir: join(fabDir, 'Staging', entry.id) },
      { onProgress: (event) => progress({ stage: 'downloading', percent: event.percent, downloaded: event.downloaded, total: event.total }) },
    );
    // The build's files are Content/<Pack>/...: the pack's folder is its name and its content path (/Game/<Pack>).
    const [root, pack] = (result.files[0] ?? '').split(/[\\/]/);
    if (root !== 'Content' || !pack) throw new Error(`the pack's files are not under Content/<Pack>: ${result.files[0]}`);
    ignoreFolder(join(projectDir, 'Content', pack));
    const missing = Object.keys(result.missingPlugins ?? {});
    if (missing.length) log(`[fab] ${pack} needs plugins that are not enabled: ${missing.join(', ')}`);
    progress({ stage: 'cooking' });
    const built = await new Promise((resolvePromise, reject) => pipeline.enqueuePack(pack, (err, value) => (err ? reject(err) : resolvePromise(value))));
    broadcast(built.manifest);
    return { kind: 'pack', pack, contentPath: `/Game/${pack}/`, files: result.files.length, missingPlugins: result.missingPlugins ?? {}, container: built.manifest.packs[pack].pak };
  }

  // FFabDownloadRequest::GetFilenameFromURL: the last path segment without the query.
  const fileNameOf = (url) => decodeURIComponent(new URL(url).pathname.split('/').pop() || 'download');

  async function download(url, file, progress) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`the download failed: HTTP ${response.status}`);
    const total = Number(response.headers.get('content-length')) || 0;
    let received = 0;
    let shown = -1;
    const body = Readable.fromWeb(response.body);
    body.on('data', (chunk) => {
      received += chunk.length;
      const percent = total ? Math.floor((received / total) * 100) : 0;
      if (percent !== shown) progress({ stage: 'downloading', percent: (shown = percent), downloaded: received, total });
    });
    mkdirSync(dirname(file), { recursive: true });
    await streamPipeline(body, createWriteStream(file));
  }

  // Windows' own tar (bsdtar) reads zip archives; the runtime build uses it for the V8 archive too.
  function unzip(archive, dir) {
    mkdirSync(dir, { recursive: true });
    const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
    const result = spawnSync(tar, ['-xf', archive, '-C', dir], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`${basename(archive)} could not be unpacked: ${result.stderr}`);
  }

  async function installModel(entry, downloadUrl, progress) {
    const downloaded = join(fabDir, 'Downloads', entry.id, fileNameOf(downloadUrl));
    await download(downloadUrl, downloaded, progress);
    const dir = join(devDir, MODELS_DIR, folderName(entry.name || entry.id));
    rmSync(dir, { recursive: true, force: true });
    ignoreFolder(dir);
    if (/\.zip$/i.test(downloaded)) {
      unzip(downloaded, dir);
      // Archives inside the archive are unpacked beside themselves, as GenericImportWorkflow does.
      for (const inner of listFiles(dir).filter((file) => /\.zip$/i.test(file))) unzip(inner, join(dirname(inner), `${basename(inner, '.zip')}_extracted`));
    } else {
      cpSync(downloaded, join(dir, basename(downloaded)));
    }
    // glTF first, then FBX, as GenericImportWorkflow looks for them; the largest of a kind is the model itself.
    const files = listFiles(dir);
    const ofKind = (extensions) => files.filter((file) => extensions.includes(extname(file).toLowerCase())).sort((a, b) => statSync(b).size - statSync(a).size);
    const model = ofKind(['.glb', '.gltf'])[0] ?? ofKind(['.fbx'])[0];
    if (!model) throw new Error(`no glTF, GLB or FBX file in what ${entry.name} delivered (${files.length} files in ${dir})`);
    const key = relative(devDir, model).replaceAll('\\', '/');
    progress({ stage: 'importing' });
    const built = await new Promise((resolvePromise, reject) => pipeline.enqueue(model, key, (err, value) => (err ? reject(err) : resolvePromise(value))));
    broadcast(built.manifest);
    const objects = built.manifest.assets[key]?.objects ?? [];
    // `key` is the file's path from the dev folder: game code imports it by its relative path (contentAssetsPlugin).
    return { kind: 'model', key, objects, files: files.length };
  }

  // PluginInstallWorkflow::RelocatePlugin: the plugin's folder, wherever the build put it, becomes
  // Plugins/Marketplace/<Name>.
  function relocatePlugin(pluginsDir, files) {
    const descriptor = files.find((file) => /\.uplugi(n)?$/i.test(file));
    const name = basename(descriptor).replace(/\.uplugi(n)?$/i, '');
    const source = join(pluginsDir, dirname(descriptor));
    const target = join(pluginsDir, 'Marketplace', name);
    if (resolve(source) !== resolve(target)) {
      rmSync(target, { recursive: true, force: true });
      cpSync(source, target, { recursive: true });
      rmSync(source, { recursive: true, force: true });
      const nested = dirname(descriptor).split('/')[0];
      if (dirname(descriptor).includes('/')) rmSync(join(pluginsDir, nested), { recursive: true, force: true });
    }
    return { name, dir: target };
  }

  function buildRuntime(entry, progress) {
    // A file name from the install's id (`plugin:<Name>` for a plugin from disk: no colon in a Windows file name).
    const logFile = join(fabDir, `build-cpp-${entry.id.replace(/[^\w.-]/g, '-')}.log`);
    progress({ stage: 'building the runtime' });
    return new Promise((resolvePromise, reject) => {
      const out = createWriteStream(logFile);
      const child = spawn(process.execPath, [join(devDir, 'tools', 'build-cpp.mjs')], { cwd: devDir, windowsHide: true });
      child.stdout.pipe(out);
      child.stderr.pipe(out);
      child.on('error', reject);
      child.on('close', (code) => (code === 0 ? resolvePromise(logFile) : reject(new Error(`npm run build:cpp failed with exit code ${code}; log: ${logFile}`))));
    });
  }

  async function installPlugin(entry, downloadUrl, baseUrls, progress) {
    const pluginsDir = join(projectDir, 'Plugins');
    const result = await service.call(
      'fab-install',
      { kind: 'plugin', manifestUrl: downloadUrl, baseUrls, installDir: pluginsDir, stagingDir: join(fabDir, 'Staging', entry.id) },
      { onProgress: (event) => progress({ stage: 'downloading', percent: event.percent, downloaded: event.downloaded, total: event.total }) },
    );
    return setUpPlugin(entry, pluginsDir, result.files, progress);
  }

  // The plugin's files are under Plugins (`files`, from there): it goes into Plugins/Marketplace/<Name>, enabled, and
  // the runtime is built with it.
  async function setUpPlugin(entry, pluginsDir, files, progress) {
    const plugin = relocatePlugin(pluginsDir, files);
    const descriptorFile = join(plugin.dir, `${plugin.name}.uplugin`);
    const descriptor = JSON.parse(readFileSync(descriptorFile, 'utf8').replace(/^\uFEFF/, ''));
    const modules = (descriptor.Modules ?? []).map((module) => module.Name);
    // A plugin in the project is enabled unless its descriptor says otherwise (IPlugin::IsEnabledByDefault). One
    // that does is enabled in its own descriptor, the user's copy: the project file stays free of plugins that only
    // this machine has.
    if (descriptor.EnabledByDefault === false) {
      writeFileSync(descriptorFile, `${JSON.stringify({ ...descriptor, EnabledByDefault: true }, null, '\t')}\n`);
    }
    // The game is monolithic: a plugin's code is linked into it, and its content is cooked into the base.
    const logFile = await buildRuntime(entry, progress);
    return { kind: 'plugin', plugin: plugin.name, dir: plugin.dir, modules, buildLog: logFile, restartDevServer: true };
  }

  // One install, kept in installs.json and told to the user (notify) as it goes: `work(entry, report)` does it.
  async function track(entry, work, progress = () => {}) {
    const { id } = entry;
    if (installs[id]?.state === 'started' && Date.now() - Date.parse(installs[id].startedAt) < 6 * 3600_000) {
      throw new Error(`${entry.name} is already being installed`);
    }
    Object.assign(entry, { state: 'started', startedAt: new Date().toISOString() });
    installs[id] = entry;
    saveInstalls();
    notify(entry);
    const report = (value) => {
      const changed = value.stage !== entry.progress?.stage || Math.floor(value.percent ?? -1) !== Math.floor(entry.progress?.percent ?? -1);
      entry.progress = value;
      progress(value);
      if (changed) notify(entry);
    };
    log(`[fab] ${entry.method} ${entry.name} (${id}, ${entry.type})`);
    try {
      const result = await work(entry, report);
      Object.assign(entry, { state: 'done', result, finishedAt: new Date().toISOString() });
      log(`[fab] ${entry.name} is in the project: ${JSON.stringify(result)}`);
      return result;
    } catch (err) {
      Object.assign(entry, { state: 'failed', error: err.message, finishedAt: new Date().toISOString() });
      log(`[fab] ${entry.name} failed: ${err.message}`);
      throw err;
    } finally {
      saveInstalls();
      notify(entry);
    }
  }

  function install(method, downloadUrl, metadata, progress) {
    const id = field(metadata, 'AssetId') ?? `${Date.now()}`;
    const type = field(metadata, 'AssetType') ?? '';
    const entry = { id, name: field(metadata, 'AssetName') ?? id, type, method };
    const baseUrls = field(metadata, 'DistributionPointBaseUrls') ?? [];
    return track(
      entry,
      (each, report) => {
        if (method === 'installtoproject' || method === 'installtoengine') return installPlugin(each, downloadUrl, baseUrls, report);
        if (type === 'unreal-engine') return installPack(each, downloadUrl, baseUrls, report);
        if (['gltf', 'glb', 'fbx'].includes(type) || field(metadata, 'IsQuixel')) return installModel(each, downloadUrl, report);
        throw new Error(`the kit does not take ${type || 'this kind of'} listings yet`);
      },
      progress,
    );
  }

  // A plugin already on disk (a folder holding <Name>.uplugin and its Source, as a Fab download lays it out): from
  // there on, the same install as Install Plugin's after its download (setUpPlugin).
  function addPlugin(from) {
    const descriptor = readdirSync(from).find((file) => /\.uplugin$/i.test(file));
    if (!descriptor) throw new Error(`no .uplugin in ${from}`);
    const name = descriptor.replace(/\.uplugin$/i, '');
    const pluginsDir = join(projectDir, 'Plugins');
    return track({ id: `plugin:${name}`, name, type: 'plugin', method: 'installtoproject' }, (entry, report) => {
      report({ stage: 'copying' });
      const target = join(pluginsDir, 'Marketplace', name);
      rmSync(target, { recursive: true, force: true });
      cpSync(from, target, { recursive: true, filter: (path) => !/[\\/](Binaries|Intermediate)([\\/]|$)/.test(path.slice(from.length)) });
      return setUpPlugin(entry, pluginsDir, [`Marketplace/${name}/${descriptor}`], report);
    });
  }

  // One call of window.ue.fab from the Fab window. `progress` reports how far a long call is.
  async function call(method, args, progress) {
    switch (method) {
      case 'getapiversion':
        return apiVersion();
      case 'getsettings':
        return settings();
      case 'setpreferredqualitytier':
        writeFileSync(settingsFile, JSON.stringify({ ...settings(), preferredquality: args[0] }, null, 2));
        return null;
      case 'getauthtoken':
        return (await service.call('fab-token')).accessToken;
      case 'getrefreshtoken':
        return (await service.call('fab-token')).refreshToken;
      case 'login':
        log('[fab] signing in through the Epic account portal');
        return (await service.call('fab-login')).accessToken;
      case 'logout':
        await service.call('fab-logout');
        return null;
      case 'addtoproject':
      case 'installtoproject':
      case 'installtoengine':
        return install(method, args[0], args[1], progress);
      default:
        throw new Error(`window.ue.fab.${method} is not served by the kit`);
    }
  }

  return { call, addPack, addPlugin, installs: () => installs };
}
