// Starts one game process (the main scene or a lab: its own engine world, V8 and HUD page) against the running
// dev server, for `npm run play`. The game is the shared runtime's; it connects to this kit's dev server port and
// logs to this kit's Saved/Logs/<name>-<time>.log.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ports, runtimeDir, unrealRoot } from './engine.mjs';
import { trackProcess } from './processes.mjs';

const logDir = resolve(unrealRoot, 'Saved/Logs');

export const gameExe = () => join(runtimeDir(), 'Build', 'Package', 'Windows', 'VibeGameEngine', 'Binaries', 'Win64', 'VibeGameEngine.exe');

// `cdp` opens the HUD page's DevTools on that port (tools/ui.mjs); `headless` runs without rendering.
export function startGame({ name, scene, headless = false, width = 1280, height = 720, cdp }) {
  mkdirSync(logDir, { recursive: true });
  const log = resolve(logDir, `${name}-${Date.now()}.log`);
  const args = [`-Scene=${scene}`, `-DevServer=ws://127.0.0.1:${ports().dev}/__unreal`, `-abslog=${log}`];
  if (headless) args.push('-nullrhi');
  else args.push('-windowed', `-ResX=${width}`, `-ResY=${height}`);
  if (cdp && !headless) args.push(`-cefdebug=${cdp}`);
  const child = spawn(gameExe(), args, { detached: true, stdio: 'ignore' });
  child.unref();
  trackProcess('game', child.pid);
  return { child, log };
}
