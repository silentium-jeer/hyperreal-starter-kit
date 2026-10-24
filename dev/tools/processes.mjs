// The processes a kit started (its dev server, games and shell), so a kit stops only its own and several kits (the
// main checkout and its profiles, `npm run profile`) run side by side. Each kit lists its own in Saved/processes.json;
// a dev server also registers in the machine's runtime store which runtime it holds, because its content service
// keeps that runtime's editor DLLs open and the runtime must not be rebuilt under it.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { repoRoot } from './engine.mjs';

const listFile = join(repoRoot, 'Saved', 'processes.json');
const inUseDir = join(homedir(), '.vge', 'in-use');

export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return err.code === 'EPERM';
  }
}

const readList = () => (existsSync(listFile) ? JSON.parse(readFileSync(listFile, 'utf8')) : []);
function writeList(list) {
  mkdirSync(join(repoRoot, 'Saved'), { recursive: true });
  writeFileSync(listFile, `${JSON.stringify(list, null, 2)}\n`);
}

export function trackProcess(kind, pid) {
  writeList([...ownProcesses(), { kind, pid, started: new Date().toISOString() }]);
}

// This kit's processes that are still running.
export function ownProcesses() {
  return readList().filter((entry) => isAlive(entry.pid));
}

export function stopOwnProcesses(kinds) {
  const stopped = [];
  for (const entry of ownProcesses()) {
    if (kinds && !kinds.includes(entry.kind)) continue;
    try {
      process.kill(entry.pid);
      stopped.push(entry);
    } catch {}
  }
  writeList(ownProcesses());
  return stopped;
}

// Called by the dev server: the runtime it holds, until it exits.
export function registerRuntimeUse(runtime) {
  mkdirSync(inUseDir, { recursive: true });
  const file = join(inUseDir, `${process.pid}.json`);
  writeFileSync(file, JSON.stringify({ pid: process.pid, runtime: resolve(runtime), kit: repoRoot }));
  process.on('exit', () => rmSync(file, { force: true }));
}

// The live dev servers, of any kit on this machine, that hold `runtime`.
export function runtimeUsers(runtime) {
  if (!existsSync(inUseDir)) return [];
  const users = [];
  for (const name of readdirSync(inUseDir)) {
    const file = join(inUseDir, name);
    const entry = JSON.parse(readFileSync(file, 'utf8'));
    if (!isAlive(entry.pid)) rmSync(file, { force: true });
    else if (entry.runtime === resolve(runtime)) users.push(entry);
  }
  return users;
}
