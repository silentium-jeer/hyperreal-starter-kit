// Owner of the resident VgeContentService process (a warm UnrealEditor-Cmd), the way Vite owns
// esbuild: started with the dev server, restarted if it dies, stopped with the server, spoken to with
// JSON lines over stdio.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const READY_TIMEOUT_MS = 180_000;

export function createContentService({ editorCmd, project, logFile, log = console.log }) {
  let child;
  let readyPromise;
  let nextId = 0;
  let stopping = false;
  const pending = new Map();

  function start() {
    const started = Date.now();
    child = spawn(editorCmd, [project, '-run=VgeContentService', '-unattended', '-nullrhi', '-nosplash', '-stdout', `-abslog=${logFile}`], { windowsHide: true });
    const proc = child;
    readyPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`content service not ready after ${READY_TIMEOUT_MS / 1000} s; log: ${logFile}`)), READY_TIMEOUT_MS);
      createInterface({ input: proc.stdout }).on('line', (line) => {
        if (!line.startsWith('@@vge ')) return;
        const message = JSON.parse(line.slice('@@vge '.length));
        if (message.event === 'ready') {
          clearTimeout(timer);
          log(`[service] ready in ${((Date.now() - started) / 1000).toFixed(1)} s (pid ${proc.pid})`);
          resolve();
          return;
        }
        const waiter = pending.get(message.id);
        if (waiter) {
          pending.delete(message.id);
          waiter.resolve(message);
        }
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        reject(new Error(`content service exited with code ${code} before it was ready; log: ${logFile}`));
      });
    });
    readyPromise.catch(() => {});
    // A spawn that fails (the engine moved or was uninstalled) is reported, not left to crash the dev server.
    proc.on('error', (err) => {
      stopping = true;
      log(`[service] could not start ${editorCmd}: ${err.message}; run \`npm run setup\``);
    });
    proc.on('exit', (code) => {
      for (const [id, waiter] of pending) waiter.reject(new Error(`content service exited with code ${code} during request ${id}; log: ${logFile}`));
      pending.clear();
      if (!stopping && proc === child) {
        log(`[service] exited with code ${code}, restarting`);
        start();
      }
    });
  }

  async function call(cmd, args = {}) {
    if (!child) start();
    await readyPromise;
    const id = ++nextId;
    const reply = await new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      child.stdin.write(`${JSON.stringify({ id, cmd, ...args })}\n`);
    });
    if (!reply.ok) throw new Error(`content service ${cmd} failed: ${reply.result?.error}; log: ${logFile}`);
    return { ...reply.result, seconds: reply.seconds };
  }

  // Resolves once the process has exited and let go of the project's editor DLLs.
  function stop() {
    stopping = true;
    const proc = child;
    if (!proc || proc.exitCode !== null) return Promise.resolve();
    const exited = new Promise((resolve) => proc.once('exit', resolve));
    proc.stdin.end();
    return exited;
  }

  return { start: () => child || start(), call, stop };
}
