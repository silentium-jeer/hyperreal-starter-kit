// Opens the Hyperreal Starter Kit shell from the shared runtime on the dev server: npm run shell
// Its worlds are the runtime's game; its logs and CEF cache go to this kit's Saved.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { repoRoot, runtimeDir } from './engine.mjs';
import { gameExe } from './game-process.mjs';

const exe = join(runtimeDir(), 'Build', 'Shell', 'HyperrealStarterKit.exe');
const child = spawn(exe, [`--game=${gameExe()}`, `--saved=${join(repoRoot, 'Saved')}`], { detached: true, stdio: 'ignore' });
child.unref();
console.log(`[shell] started, pid ${child.pid}`);
