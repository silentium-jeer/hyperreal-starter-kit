// What a machine needs before the kit runs, each with how to check it and the exact command that fixes it.
// `npm run doctor` prints them; `npm run setup` stops at the first missing requirement it cannot fix itself.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ENGINE_VERSION, engineCandidates, engineVersion, findEngine, linkedRuntime, unrealRoot } from './engine.mjs';
import { LINKS, runtimeKey, runtimePath } from './runtime.mjs';

const VSWHERE = join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe');

// The Visual Studio components the engine itself suggests (Engine/Config/Windows/Windows_SDK.json): the MSVC
// toolchain, its ATL and the Windows SDK, installed as Build Tools (the compiler without the IDE).
export function toolchainInstallCommand(engineRoot = findEngine()) {
  const sdk = engineRoot ? JSON.parse(readFileSync(join(engineRoot, 'Engine', 'Config', 'Windows', 'Windows_SDK.json'), 'utf8')) : {};
  const components = [
    'Microsoft.VisualStudio.Workload.VCTools',
    'Microsoft.VisualStudio.Component.VC.Tools.x86.x64',
    ...(sdk.VisualStudioSuggestedComponents ?? []).filter((c) => /Windows1\dSDK/.test(c)),
    ...(sdk.VisualStudio2022SuggestedComponents ?? []),
  ];
  const override = ['--quiet', '--wait', '--norestart', ...components.flatMap((c) => ['--add', c])].join(' ');
  return `winget install --id Microsoft.VisualStudio.2022.BuildTools --exact --accept-package-agreements --accept-source-agreements --override "${override}"`;
}

// The newest Visual Studio or Build Tools with the MSVC x64 toolchain, as Visual Studio's own locator reports it.
export function msvcInstance() {
  if (!existsSync(VSWHERE)) return null;
  const found = execFileSync(VSWHERE, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-format', 'json'], { encoding: 'utf8' });
  return JSON.parse(found || '[]')[0] ?? null;
}

function msvc() {
  const instance = msvcInstance();
  return instance ? `${instance.displayName} ${instance.installationVersion}` : null;
}

// The engine's own verdict on the Windows SDK (Turnkey VerifySdk), not a guess from folder names.
function windowsSdk(engineRoot) {
  // Quoted: with a shell, an engine under "C:\Program Files\..." would otherwise split at the space.
  const runUat = `"${join(engineRoot, 'Engine', 'Build', 'BatchFiles', 'RunUAT.bat')}"`;
  const result = spawnSync(runUat, ['Turnkey', '-command=VerifySdk', '-platform=Win64', '-UpdateIfNeeded=false', '-unattended'], { encoding: 'utf8', shell: true });
  const line = (result.stdout ?? '').split('\n').find((l) => l.startsWith('Win64:'));
  return { valid: Boolean(line?.includes('Status=Valid')), detail: line?.trim() ?? `Turnkey exited with ${result.status}` };
}

const exists = (...parts) => existsSync(join(unrealRoot, ...parts));

// Every requirement in order; `fix` is a command, or what to do when no command can do it.
export function checkAll() {
  const results = [];
  const add = (name, ok, detail, fix) => results.push({ name, ok, detail, fix: ok ? undefined : fix });

  const [major, minor] = process.versions.node.split('.').map(Number);
  // The dev server loads the web-starter-kit's Vite plugin as TypeScript (vite/environments.mjs), which needs
  // Node's built-in type stripping without a flag: Node 22.18+ or 23.6+.
  add('node', major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18), `Node ${process.versions.node}`, 'install Node 22.18+ (https://nodejs.org)');

  const engineRoot = findEngine();
  const version = engineRoot && engineVersion(engineRoot);
  add(
    'engine',
    Boolean(engineRoot),
    engineRoot ? `Unreal Engine ${version.major}.${version.minor}.${version.patch} at ${engineRoot}` : `looked at: ${engineCandidates().map((c) => `${c.source} ${c.root}`).join('; ') || 'nothing registered'}`,
    `install Unreal Engine ${ENGINE_VERSION.major}.${ENGINE_VERSION.minor} from the Epic Games Launcher, or set VGE_ENGINE to its folder`,
  );

  const compiler = msvc();
  add('msvc', Boolean(compiler), compiler ?? 'no Visual Studio or Build Tools with the MSVC x64 toolchain', 'npm run setup -- --install-toolchain');
  if (engineRoot) {
    const sdk = windowsSdk(engineRoot);
    add('windows-sdk', sdk.valid, sdk.detail, 'npm run setup -- --install-toolchain');
  }

  const runtime = linkedRuntime();
  const built = Boolean(runtime && existsSync(join(runtime, 'runtime.json')));
  add('runtime', built, built ? `shared runtime ${runtime}` : 'this kit is not linked to a built runtime', 'npm run setup');
  if (built && engineRoot) {
    const same = resolve(runtimePath(runtimeKey())) === resolve(runtime);
    add('runtime-sources', same, same ?'runtime built from these C++ sources' : 'the C++ side changed since the runtime was built', 'npm run build:cpp');
  }
  add('links', LINKS.every((path) => exists(path)), `${LINKS.join(', ')} from the runtime`, 'npm run setup');
  return results;
}
