// First start of a fresh clone: finds everything the kit needs on this machine and links the kit to the runtime
// every kit on the machine shares, building it first when no kit with these C++ sources has built it yet.
//   npm run setup               every step that is not done yet
//   npm run setup -- --rebuild  build the runtime again even when it exists
//   npm run setup -- --install-toolchain   install the MSVC Build Tools first when they are missing
// `npm run doctor` reports the same requirements without changing anything.
import { spawnSync } from 'node:child_process';
import { findEngine, saveEngine } from './engine.mjs';
import { checkAll, toolchainInstallCommand } from './prereqs.mjs';
import { ensureRuntime, linkKit } from './runtime.mjs';

const TAG = 'setup';
const rebuild = process.argv.includes('--rebuild');
const installToolchain = process.argv.includes('--install-toolchain');

const say = (message) => console.log(`[${TAG}] ${message}`);
function fail(message) {
  console.error(`[${TAG}] ${message}`);
  process.exit(1);
}

// Node, the engine, the MSVC toolchain and the Windows SDK: what setup cannot fetch itself.
// UnrealBuildTool compiles the runtime's modules with MSVC; with --install-toolchain setup installs the Build
// Tools (compiler without the IDE) with the components the engine names, then checks again.
const MACHINE = ['node', 'engine', 'msvc', 'windows-sdk'];
function checkMachine() {
  let missing = checkAll().filter((r) => MACHINE.includes(r.name) && !r.ok);
  const toolchainMissing = missing.some((r) => r.name === 'msvc' || r.name === 'windows-sdk');
  if (toolchainMissing && installToolchain && !missing.some((r) => r.name === 'engine')) {
    const command = toolchainInstallCommand();
    say(`installing the C++ toolchain (Windows asks for administrator rights once):\n  ${command}`);
    const result = spawnSync(command, { stdio: 'inherit', shell: true });
    if (result.status !== 0) say(`winget exited with ${result.status}`);
    missing = checkAll().filter((r) => MACHINE.includes(r.name) && !r.ok);
  }
  for (const r of checkAll().filter((r) => MACHINE.includes(r.name) && r.ok)) say(r.detail);
  if (missing.length) fail(missing.map((r) => `missing ${r.name}: ${r.detail}\n  fix: ${r.fix}`).join('\n'));
  saveEngine(findEngine());
}

const started = Date.now();
checkMachine();
linkKit(TAG, await ensureRuntime(TAG, { rebuild }));

say(`ready in ${((Date.now() - started) / 60000).toFixed(1)} min. Next, from dev/:`);
say('  npm run dev    dev server: Vite, hot reload, content service');
say('  npm run shell  the app: the main scene, the labs and the UI kit');
say('  npm run play   one game window on the main scene (-- --scene labs/playground for the playground)');
