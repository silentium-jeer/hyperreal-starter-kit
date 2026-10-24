import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, cpSync, createWriteStream, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { engine, repoRoot, saveRuntime } from './engine.mjs';
import { isAlive, runtimeUsers } from './processes.mjs';
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

// The runtime's V8 is a junction to the shared copy. A runtime folder on a volume without junctions (exFAT: the
// store's folder linked to another drive) gets its own copy instead.
function linkV8(tag, link) {
  if (!isLink(link) && hasV8(link)) return;
  try {
    junction(sharedV8, link);
  } catch (err) {
    if (err.code !== 'EISDIR' && err.code !== 'EPERM') throw err;
    for (const part of V8_PARTS) cpSync(join(sharedV8, part), join(link, part), { recursive: true });
    console.log(`[${tag}] ${dirname(link)} cannot hold a junction; V8 copied into the runtime`);
  }
}

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
  writeFileSync(join(dir, BUILDING), JSON.stringify({ pid: process.pid }));
  await fetchV8(tag);
  linkV8(tag, join(dir, 'Plugins', 'Puerts', 'ThirdParty', V8_DIR));
  copyMannequin(tag, dir);
  buildTargets(tag, dir);
  typings(tag, dir);
  if (!existsSync(join(dir, 'Content', 'Vge', 'Materials', 'Gltf', 'M_Default.uasset'))) masterMaterials(tag, dir);
  packageBase(tag, dir);
  buildShell(tag, dir);
  pruneBuildLeftovers(dir);
  writeFileSync(join(dir, 'runtime.json'), `${JSON.stringify({ key, engine: engine().root, sources: files.length, builtAt: new Date().toISOString() }, null, 2)}\n`);
  rmSync(join(dir, BUILDING), { force: true });
  console.log(`[${tag}] runtime ${key} built in ${((Date.now() - started) / 60000).toFixed(1)} min`);
  return dir;
}

// Old runtimes go away by themselves: every link of a kit removes the runtimes no kit on this machine links to, that
// no running dev server holds and that no build is writing. Kits register what they link in ~/.vge/kits.
const BUILDING = 'building.json';
const kitsDir = join(storeRoot, 'kits');

function registerKit(dir) {
  mkdirSync(kitsDir, { recursive: true });
  const name = createHash('sha256').update(resolve(repoRoot).toLowerCase()).digest('hex').slice(0, 16);
  writeFileSync(join(kitsDir, `${name}.json`), JSON.stringify({ kit: resolve(repoRoot), runtime: resolve(dir) }));
}

// The checkouts of this repository (the main kit and its profiles) count as registered even before their next link.
function worktrees() {
  const out = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  return [...out.matchAll(/^worktree (.+)$/gm)].map((match) => resolve(match[1]));
}

function linkedRuntimes() {
  const linked = new Set();
  for (const kit of worktrees()) {
    const config = join(kit, 'vge.config.json');
    const runtime = existsSync(config) ? JSON.parse(readFileSync(config, 'utf8')).runtime : undefined;
    if (runtime) linked.add(resolve(runtime));
  }
  if (!existsSync(kitsDir)) return linked;
  for (const name of readdirSync(kitsDir)) {
    const file = join(kitsDir, name);
    const { kit } = JSON.parse(readFileSync(file, 'utf8'));
    const config = join(kit, 'vge.config.json');
    const runtime = existsSync(config) ? JSON.parse(readFileSync(config, 'utf8')).runtime : undefined;
    if (runtime) linked.add(resolve(runtime));
    else rmSync(file, { force: true });
  }
  return linked;
}

function beingBuilt(dir) {
  const file = join(dir, BUILDING);
  return existsSync(file) && isAlive(JSON.parse(readFileSync(file, 'utf8')).pid);
}

// A runtime folder may be a junction to another drive, and holds a junction to the shared V8: links are removed as
// links (rmSync does not follow them), the folder a store junction points to is removed with it.
function removeRuntime(dir) {
  const target = isLink(dir) ? resolve(readlinkSync(dir)) : null;
  if (target) {
    rmSync(target, { recursive: true, force: true });
    unlinkSync(dir);
  } else {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function pruneRuntimes(tag) {
  const root = join(storeRoot, 'Runtime');
  if (!existsSync(root)) return;
  const keep = linkedRuntimes();
  for (const name of readdirSync(root)) {
    const dir = join(root, name);
    if (keep.has(resolve(dir)) || runtimeUsers(dir).length || beingBuilt(dir)) continue;
    removeRuntime(dir);
    console.log(`[${tag}] removed runtime ${name}: no kit links it, nothing runs on it`);
  }
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
  registerKit(dir);
  console.log(`[${tag}] kit linked to runtime ${dir}`);
  pruneRuntimes(tag);
}
