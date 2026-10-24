// Opens the Hyperreal Starter Kit shell from the shared runtime on this kit's dev server: npm run shell
// Its worlds are the runtime's game; its logs and CEF cache go to this kit's Saved.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { devServerUrl, ports, repoRoot, runtimeDir, shellSecret } from './engine.mjs';
import { gameExe } from './game-process.mjs';
import { trackProcess } from './processes.mjs';

const exe = join(runtimeDir(), 'Build', 'Shell', 'HyperrealStarterKit.exe');
const args = [`--url=${devServerUrl()}/`, `--cdp=${ports().shell}`, `--game=${gameExe()}`, `--saved=${join(repoRoot, 'Saved')}`, `--secret=${shellSecret()}`];
const child = spawn(exe, args, { detached: true, stdio: 'ignore' });
child.unref();
trackProcess('shell', child.pid);
console.log(`[shell] started, pid ${child.pid}`);
