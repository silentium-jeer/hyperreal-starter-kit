import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { engine, repoRoot, saveRuntime } from './engine.mjs';
import { buildShell, buildTargets, masterMaterials, packageBase, refuseRebuildingRuntimeInUse, typings } from './steps.mjs';

export const V8_VERSION = '11.8.172';
const SOURCES = ['VibeGameEngine.uproject', 'Source', 'Config', 'Content', 'Plugins', 'shell/src'];
export const LINKS = ['Binaries', 'Plugins/Puerts/Binaries', 'Releases', 'Typing', 'Content/Vge/Materials', 'Content/Characters/Mannequins'];
export const storeRoot = join(homedir(), '.vge');
const V8_DIR = `v8_${V8_VERSION}`;
const V8_URL = `https://github.com/puerts/backend-v8/releases/download/V8_${V8_VERSION}__251225/v8_bin_${V8_VERSION}.tar.gz`;
const sharedV8 = join(storeRoot, 'V8', V8_DIR);

export function sourceFiles() {
  return execFileSync('git', ['ls-files', '-co', '--exclude-standard', '-z', '--', ...SOURCES], { cwd: repoRoot, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .sort();
}

function engineIdentity() {
  const dir = join(engine().root, 'Engine');
  const { BuildId } = JSON.parse(readFileSync(join(dir, 'Binaries', 'Win64', 'UnrealEditor.modules'), 'utf8'));
  return `${readFileSync(join(dir, 'Build', 'Build.version'), 'utf8')}\0${BuildId}\0${V8_VERSION}`;
}

export function runtimeKey(files = sourceFiles()) {
  const blobs = execFileSync('git', ['hash-object', '--stdin-paths'], { cwd: repoRoot, input: files.join('\n'), encoding: 'utf8' }).trim().split('\n');
  const hash = createHash('sha256').update(engineIdentity());
  files.forEach((file, index) => hash.update(`\0${file}\0${blobs[index]}`));
  return hash.digest('hex').slice(0, 16);
}

export const runtimePath = (key) => join(storeRoot, 'Runtime', key);
export const isBuilt = (dir) => existsSync(join(dir, 'runtime.json'));

const isLink = (path) => lstatSync(path, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;

function junction(target, link) {
  if (isLink(link)) {
    if (resolve(readlinkSync(link)) === resolve(target)) return;
    unlinkSync(link);
  }
  mkdirSync(dirname(link), { recursive: true });
  symlinkSync(target, link, 'junction');
}

const V8_PARTS = ['Inc', 'Lib/Win64MD', 'Lib/Win64DLL'];
const hasV8 = (dir) => V8_PARTS.every((part) => existsSync(join(dir, part)));

async function fetchV8(tag) {
  if (hasV8(sharedV8)) return;
  mkdirSync(dirname(sharedV8), { recursive: true });
  const archive = join(dirname(sharedV8), `v8_bin_${V8_VERSION}.tar.gz`);
  console.log(`[${tag}] downloading V8 ${V8_VERSION} binaries for Puerts (~370 MB) from ${V8_URL}`);
  const response = await fetch(V8_URL);
  if (!response.ok) throw new Error(`V8 download failed: HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length'));
  let received = 0;
  let shown = 0;
  const body = Readable.fromWeb(response.body);
  body.on('data', (chunk) => {
    received += chunk.length;
    const percent = Math.floor((received / total) * 100);
    if (percent >= shown + 10) console.log(`[${tag}]   ${(shown = percent)}%`);
  });
  await pipeline(body, createWriteStream(archive));
  const tar = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  const members = V8_PARTS.map((part) => `${V8_DIR}/${part}`);
  const result = spawnSync(tar, ['-xzf', archive, '-C', dirname(sharedV8), ...members], { stdio: 'inherit' });
  rmSync(archive, { force: true });
  if (result.status !== 0 || !hasV8(sharedV8)) throw new Error('V8 archive could not be extracted');
  console.log(`[${tag}] V8 ${V8_VERSION} binaries in ${sharedV8}`);
}

function stageSources(dir, files) {
  for (const file of files) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    copyFileSync(join(repoRoot, file), join(dir, file));
  }
}

function copyMannequin(tag, dir) {
  const target = join(dir, 'Content', 'Characters', 'Mannequins');
  if (existsSync(join(target, 'Meshes'))) return;
  const source = join(engine().templates, 'High', 'Characters', 'Content', 'Mannequins');
  if (!existsSync(source)) throw new Error(`the engine has no template Mannequin at ${source}; install the engine's templates from the launcher`);
  cpSync(source, target, { recursive: true });
  console.log(`[${tag}] Mannequin copied from ${source}`);
}

const CRYPTO = join('Saved', 'Cooked', 'Windows', 'VibeGameEngine', 'Metadata', 'Crypto.json');

export function pruneBuildLeftovers(dir) {
  const crypto = existsSync(join(dir, CRYPTO)) ? readFileSync(join(dir, CRYPTO)) : null;
  for (const path of ['Intermediate', 'Plugins/Puerts/Intermediate', 'Saved/StagedBuilds', 'Saved/Cooked']) {
    rmSync(join(dir, path), { recursive: true, force: true });
  }
  for (const file of ['VibeGameEngine.exe', 'VibeGameEngine.pdb', 'VibeGameEngine-Win64-Shipping.pdb']) {
    rmSync(join(dir, 'Binaries', 'Win64', file), { force: true });
  }
  if (crypto) {
    mkdirSync(dirname(join(dir, CRYPTO)), { recursive: true });
    writeFileSync(join(dir, CRYPTO), crypto);
  }
}

export async function ensureRuntime(tag, { rebuild = false } = {}) {
  const files = sourceFiles();
  const key = runtimeKey(files);
  const dir = runtimePath(key);
  if (isBuilt(dir) && !rebuild) {
    console.log(`[${tag}] runtime ${key} present in ${dir}`);
    return dir;
  }
  refuseRebuildingRuntimeInUse(dir);
  const started = Date.now();
  console.log(`[${tag}] building runtime ${key} in ${dir} (once per machine for these sources)`);
  rmSync(join(dir, 'runtime.json'), { force: true });
  stageSources(dir, files);
  await fetchV8(tag);
  junction(sharedV8, join(dir, 'Plugins', 'Puerts', 'ThirdParty', V8_DIR));
  copyMannequin(tag, dir);
  buildTargets(tag, dir);
  typings(tag, dir);
  if (!existsSync(join(dir, 'Content', 'Vge', 'Materials', 'Gltf', 'M_Default.uasset'))) masterMaterials(tag, dir);
  packageBase(tag, dir);
  buildShell(tag, dir);
  pruneBuildLeftovers(dir);
  writeFileSync(join(dir, 'runtime.json'), `${JSON.stringify({ key, engine: engine().root, sources: files.length, builtAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(`[${tag}] runtime ${key} built in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  return dir;
}

export function linkKit(tag, dir) {
  for (const path of LINKS) {
    const link = join(repoRoot, path);
    if (existsSync(link) && !isLink(link)) {
      const aside = join(repoRoot, 'Saved', 'Superseded', path);
      mkdirSync(dirname(aside), { recursive: true });
      rmSync(aside, { recursive: true, force: true });
      renameSync(link, aside);
      console.log(`[${tag}] ${path} was built here before the shared runtime; moved to Saved/Superseded/${path}`);
    }
    junction(join(dir, path), link);
  }
  saveRuntime(dir);
  console.log(`[${tag}] kit linked to runtime ${dir}`);
}
