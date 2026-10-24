// Where Unreal Engine 5.8 lives on this machine, for every tool that runs it (setup, build:cpp, typings, the
// content pipeline). Looked up in this order, the first that holds a 5.8 engine wins:
//   1. VGE_ENGINE environment variable (the engine root, the folder that contains Engine/)
//   2. vge.config.json at the repository root, written by `npm run setup`
//   3. the Epic Games Launcher's install list (C:\ProgramData\Epic\UnrealEngineLauncher\LauncherInstalled.dat)
//   4. the registry keys the launcher and source builds write (HKLM ...\EpicGames\Unreal Engine\5.8,
//      HKCU ...\Epic Games\Unreal Engine\Builds)
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const ENGINE_VERSION = { major: 5, minor: 8 };
export const repoRoot = resolve(import.meta.dirname, '../..');
export const project = join(repoRoot, 'VibeGameEngine.uproject');
const configFile = join(repoRoot, 'vge.config.json');

// The version of the engine at `root`, from Engine/Build/Build.version, or null when it is not an engine.
export function engineVersion(root) {
  const file = join(root, 'Engine', 'Build', 'Build.version');
  if (!existsSync(file)) return null;
  const { MajorVersion, MinorVersion, PatchVersion, Changelist } = JSON.parse(readFileSync(file, 'utf8'));
  return { major: MajorVersion, minor: MinorVersion, patch: PatchVersion, changelist: Changelist };
}

const isWanted = (root) => {
  const version = root && engineVersion(root);
  return Boolean(version && version.major === ENGINE_VERSION.major && version.minor === ENGINE_VERSION.minor);
};

const readConfig = () => (existsSync(configFile) ? JSON.parse(readFileSync(configFile, 'utf8')) : {});
const writeConfig = (patch) => writeFileSync(configFile, `${JSON.stringify({ ...readConfig(), ...patch }, null, 2)}\n`);

function fromConfig() {
  return readConfig().engine;
}

function fromLauncher() {
  const file = join(process.env.ProgramData ?? 'C:\\ProgramData', 'Epic', 'UnrealEngineLauncher', 'LauncherInstalled.dat');
  if (!existsSync(file)) return [];
  const { InstallationList = [] } = JSON.parse(readFileSync(file, 'utf8'));
  return InstallationList.filter((item) => item.NamespaceId === 'ue' && /^UE_\d+\.\d+$/.test(item.AppName)).map((item) => item.InstallLocation);
}

function registryValues(key) {
  try {
    return execFileSync('reg', ['query', key, '/s'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function fromRegistry() {
  const installed = [...registryValues('HKLM\\SOFTWARE\\EpicGames\\Unreal Engine').matchAll(/InstalledDirectory\s+REG_SZ\s+(.+)/g)].map((m) => m[1].trim());
  const builds = [...registryValues('HKCU\\SOFTWARE\\Epic Games\\Unreal Engine\\Builds').matchAll(/REG_SZ\s+(.+)/g)].map((m) => m[1].trim());
  return [...installed, ...builds];
}

// Every place an engine was looked for, with what was found there.
export function engineCandidates() {
  return [
    { source: 'VGE_ENGINE', root: process.env.VGE_ENGINE },
    { source: 'vge.config.json', root: fromConfig() },
    ...fromLauncher().map((root) => ({ source: 'Epic Games Launcher', root })),
    ...fromRegistry().map((root) => ({ source: 'registry', root })),
  ].filter((candidate) => candidate.root);
}

export function findEngine() {
  return engineCandidates().find((candidate) => isWanted(candidate.root))?.root;
}

export function saveEngine(root) {
  writeConfig({ engine: root.replaceAll('\\', '/') });
}

export function saveRuntime(dir) {
  writeConfig({ runtime: dir.replaceAll('\\', '/') });
}

export function linkedRuntime() {
  return readConfig().runtime;
}

// This kit's ports: the dev server (HTTP and the games' channel) and the DevTools ports of a game's HUD page and the
// shell's page. A profile (`npm run profile`) is a second checkout with its own ports in its vge.config.json, so its
// dev server, games and shell run beside the main kit's. VGE_PORT overrides the dev server port.
const DEFAULT_PORTS = { dev: 5173, hud: 9222, shell: 9221 };
export function ports() {
  const configured = { ...DEFAULT_PORTS, ...readConfig().ports };
  return { ...configured, dev: Number(process.env.VGE_PORT ?? configured.dev) };
}

export function savePorts(value) {
  writeConfig({ ports: value });
}

export const devServerUrl = () => `http://127.0.0.1:${ports().dev}`;

// What this kit's shell sends with its own requests to the dev server (X-Vge-Shell): the Fab window's calls go out from
// a browser, with an Origin like any web page's, and the dev server refuses web pages (server.mjs fromAPage). Made once
// per checkout in Saved, where no web page can read it; tools/shell.mjs hands it to the shell.
export function shellSecret() {
  const file = join(repoRoot, 'Saved', 'shell-secret');
  if (!existsSync(file)) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, randomBytes(32).toString('hex'));
  }
  return readFileSync(file, 'utf8').trim();
}

export function runtimeDir() {
  const dir = linkedRuntime();
  if (!dir || !existsSync(join(dir, 'runtime.json'))) throw new Error('This kit has no runtime yet; run `npm run setup`.');
  return dir;
}

// The engine's tools, or an error that says how to point the kit at the engine.
export function engine() {
  const root = findEngine();
  if (!root) {
    throw new Error(
      `Unreal Engine ${ENGINE_VERSION.major}.${ENGINE_VERSION.minor} was not found. Install it from the Epic Games Launcher, ` +
        'or set VGE_ENGINE to its folder, then run `npm run setup`.',
    );
  }
  const dir = join(root, 'Engine');
  return {
    root,
    editorCmd: join(dir, 'Binaries', 'Win64', 'UnrealEditor-Cmd.exe'),
    unrealPak: join(dir, 'Binaries', 'Win64', 'UnrealPak.exe'),
    buildBat: join(dir, 'Build', 'BatchFiles', 'Build.bat'),
    runUat: join(dir, 'Build', 'BatchFiles', 'RunUAT.bat'),
    templates: join(root, 'Templates', 'TemplateResources'),
  };
}
