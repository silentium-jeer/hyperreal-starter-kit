// The Hyperreal Starter Kit shell from the shared runtime on this kit's dev server. `npm run dev` opens it with the dev
// server (one dev session); `npm run shell` opens it again after it was closed. One shell per kit: a running one is
// kept. Its worlds are the runtime's game; its logs and CEF cache go to this kit's Saved.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { devServerUrl, ports, runtimeDir, shellSecret, unrealRoot } from './engine.mjs';
import { gameExe } from './game-process.mjs';
import { ownProcesses, trackProcess } from './processes.mjs';

export const runningShell = () => ownProcesses().find((entry) => entry.kind === 'shell') ?? null;

// Returns the shell's pid and whether this call started it.
export function startShell() {
  const running = runningShell();
  if (running) return { pid: running.pid, started: false };
  const exe = join(runtimeDir(), 'Build', 'Shell', 'HyperrealStarterKit.exe');
  // --hud-cdp: the HUD of each world the shell opens answers DevTools from the kit's HUD port on (tools/ui.mjs).
  const args = [`--url=${devServerUrl()}/`, `--cdp=${ports().shell}`, `--hud-cdp=${ports().hud}`, `--game=${gameExe()}`, `--saved=${join(unrealRoot, 'Saved')}`, `--secret=${shellSecret()}`];
  const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
  child.unref();
  trackProcess('shell', child.pid);
  return { pid: child.pid, started: true };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { pid, started } = startShell();
  console.log(started ? `[shell] started, pid ${pid}` : `[shell] already open, pid ${pid}`);
}
