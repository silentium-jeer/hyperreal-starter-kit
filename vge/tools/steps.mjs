// The build steps the kit runs against the engine, for the runtime (tools/runtime.mjs) that every kit on this
// machine shares. Each runs to completion with its output on the console and stops the caller on failure.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { engine } from './engine.mjs';
import { msvcInstance } from './prereqs.mjs';
import { ownProcesses, runtimeUsers } from './processes.mjs';

export function step(tag, label, command, args) {
  const started = Date.now();
  console.log(`[${tag}] ${label}...`);
  const result = spawnSync(`"${command}"`, args, { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    console.error(`[${tag}] ${label} failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
  console.log(`[${tag}] ${label} done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

// A dev server's content service holds the editor DLLs of the runtime it was started on. A runtime for other
// sources builds in its own folder of the store, so only rebuilding a runtime a dev server holds is refused.
export function refuseRebuildingRuntimeInUse(dir) {
  const users = runtimeUsers(dir);
  if (users.length) {
    console.error(`Stop the dev server of ${users.map((user) => `${user.kit} (pid ${user.pid})`).join(', ')} first: its content service holds ${dir}.`);
    process.exit(1);
  }
}

// This kit's dev server, if it runs: after the kit is linked to another runtime it has to be restarted to use it.
export const ownDevServer = () => ownProcesses().find((entry) => entry.kind === 'dev');

// For work that writes this kit's project content beside the dev server's own content service (the release build).
export function refuseWhileOwnDevServerRuns(work) {
  const dev = ownDevServer();
  if (dev) {
    console.error(`Stop this kit's dev server (pid ${dev.pid}, \`npm run stop\`) first: ${work}.`);
    process.exit(1);
  }
}

const projectOf = (root) => join(root, 'VibeGameEngine.uproject');
const commandlet = (root, name) => [`"${projectOf(root)}"`, `-run=${name}`, '-unattended', '-nullrhi', '-nosplash'];

// What development needs: the editor modules (content service, cooker, typings) and the Development game. Both build
// incrementally in the build tree (tools/runtime.mjs). The Shipping game is the release build's (buildShipping).
export function buildTargets(tag, root) {
  const { buildBat } = engine();
  const project = `-Project="${projectOf(root)}"`;
  step(tag, 'editor target', buildBat, ['VibeGameEngineEditor', 'Win64', 'Development', project, '-WaitMutex']);
  step(tag, 'game target', buildBat, ['VibeGameEngine', 'Win64', 'Development', project, '-WaitMutex']);
}

export function buildShipping(tag, root) {
  step(tag, 'shipping game target', engine().buildBat, ['VibeGameEngine', 'Win64', 'Shipping', `-Project="${projectOf(root)}"`, '-WaitMutex']);
}

export function typings(tag, root) {
  step(tag, 'typings', engine().editorCmd, commandlet(root, 'VgeGenTypings'));
}

export function masterMaterials(tag, root) {
  step(tag, 'master materials', engine().editorCmd, commandlet(root, 'VgeMaterials'));
}

// The base game with the release the content pipeline cooks live content against (Releases/dev). The cook is
// iterative: the build tree keeps Saved/Cooked, so only packages whose inputs changed are cooked again.
export function packageBase(tag, root) {
  step(tag, 'base package', engine().runUat, [
    'BuildCookRun',
    `-project="${projectOf(root)}"`,
    '-noP4',
    '-platform=Win64',
    '-clientconfig=Development',
    '-cook',
    '-iterate',
    '-stage',
    '-pak',
    '-iostore',
    '-archive',
    `-archivedirectory="${join(root, 'Build', 'Package')}"`,
    '-createreleaseversion=dev',
    '-unattended',
  ]);
}

function cefPaths() {
  const engineDir = join(engine().root, 'Engine');
  const thirdParty = join(engineDir, 'Source', 'ThirdParty', 'CEF3');
  const distribution = readdirSync(thirdParty).find((name) => name.startsWith('cef_binary_') && name.endsWith('_windows64'));
  const runtimeRoot = join(engineDir, 'Binaries', 'ThirdParty', 'CEF3', 'Win64');
  const runtime = join(runtimeRoot, readdirSync(runtimeRoot).find((name) => statSync(join(runtimeRoot, name)).isDirectory()));
  return {
    include: join(thirdParty, distribution),
    libcef: join(thirdParty, distribution, 'Release', 'libcef.lib'),
    wrapper: join(thirdParty, distribution, 'VS2015', 'libcef_dll_wrapper', 'Release', 'libcef_dll_wrapper.lib'),
    runtime,
  };
}

// The shell (vge/shell/src), compiled with the machine's MSVC against the CEF build that ships with the engine
// (Engine/Source/ThirdParty/CEF3: headers, libcef, the C++ wrapper; Engine/Binaries/ThirdParty/CEF3: the runtime),
// into Build/Shell/HyperrealStarterKit.exe next to a copy of that runtime.
export function buildShell(tag, root) {
  const started = Date.now();
  console.log(`[${tag}] shell...`);
  const instance = msvcInstance();
  if (!instance) throw new Error('no MSVC x64 toolchain; run `npm run doctor`');
  const cef = cefPaths();
  const sourceDir = join(root, 'shell', 'src');
  const outDir = join(root, 'Build', 'Shell');
  const objDir = join(root, 'Intermediate', 'Shell');
  mkdirSync(outDir, { recursive: true });
  mkdirSync(objDir, { recursive: true });
  const vcvars = join(instance.installationPath, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
  const units = readdirSync(sourceDir).filter((name) => name.endsWith('.cpp')).map((name) => join(sourceDir, name));
  // /MD: the engine's libcef_dll_wrapper is built against the dynamic release runtime (its RuntimeLibrary record).
  const compile = [
    'cl', '/nologo', '/std:c++20', '/EHsc', '/O2', '/MD', '/W3', '/utf-8',
    '/DUNICODE', '/D_UNICODE', '/DNOMINMAX', '/DWIN32_LEAN_AND_MEAN', '/D_WIN32_WINNT=0x0A00',
    `/I"${cef.include}"`, `/Fo"${objDir}\\\\"`, ...units.map((file) => `"${file}"`),
    '/link', `/OUT:"${join(outDir, 'HyperrealStarterKit.exe')}"`, '/SUBSYSTEM:WINDOWS', `"${cef.libcef}"`, `"${cef.wrapper}"`,
    // The application manifest (supported OS: Windows 10), embedded: vge/shell/src/HyperrealStarterKit.manifest says why.
    '/MANIFEST:EMBED', `/MANIFESTINPUT:"${join(sourceDir, 'HyperrealStarterKit.manifest')}"`,
    'user32.lib', 'gdi32.lib', 'shell32.lib', 'advapi32.lib', 'ole32.lib', 'shlwapi.lib',
  ].join(' ');
  const script = join(objDir, 'build.cmd');
  writeFileSync(script, `@echo off\r\ncall "${vcvars}" >nul\r\n${compile}\r\n`);
  const result = spawnSync('cmd.exe', ['/d', '/c', script], { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`[${tag}] shell failed with exit code ${result.status}`);
    process.exit(result.status ?? 1);
  }
  cpSync(cef.runtime, outDir, { recursive: true });
  console.log(`[${tag}] shell done in ${((Date.now() - started) / 1000).toFixed(1)} s`);
}
