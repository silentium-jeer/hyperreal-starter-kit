// Keeps one stock cook process warmed up in standby (VgeCook commandlet): the engine has already
// started when a build needs a cook, the cook itself still runs once per process, and the next standby
// process starts as soon as the current one is released.
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export function createStandbyCooker({ editorCmd, project, cookArgs, logDir, log = console.log }) {
  let standby;
  let sequence = 0;
  let stopped = false;

  function launch() {
    const logFile = join(logDir, `cook-${String(++sequence).padStart(4, '0')}.log`);
    const started = Date.now();
    const child = spawn(editorCmd, [project, '-run=VgeCook', '-RunAsCookCommandlet', ...cookArgs, '-unattended', '-stdout', `-abslog=${logFile}`], { windowsHide: true });
    const events = [];
    const listeners = [];
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (!line.startsWith('@@vge ')) return;
      const event = JSON.parse(line.slice('@@vge '.length));
      events.push(event);
      listeners.forEach((l) => l(event));
    });
    const waitFor = (name) =>
      new Promise((resolve, reject) => {
        const found = events.find((e) => e.event === name);
        if (found) return resolve(found);
        listeners.push((e) => e.event === name && resolve(e));
        child.on('exit', (code) => reject(new Error(`cook process exited with code ${code} before '${name}'; log: ${logFile}`)));
      });
    const ready = waitFor('standby').then(() => (Date.now() - started) / 1000);
    ready.catch(() => {});
    // A spawn that fails (the engine moved or was uninstalled) stops the standby instead of crashing the server.
    child.on('error', (err) => {
      stopped = true;
      log(`[cooker] could not start ${editorCmd}: ${err.message}; run \`npm run setup\``);
    });
    const exited = new Promise((resolve) => child.on('exit', resolve));
    return { child, logFile, ready, waitFor, exited };
  }

  function ensure() {
    if (!standby && !stopped) {
      standby = launch();
      standby.ready.then((seconds) => log(`[cooker] standby ready in ${seconds.toFixed(1)} s`), () => {});
    }
    return standby;
  }

  // Runs one cook in the standby process. Returns { seconds, warmup, logFile }.
  async function cook() {
    const current = ensure();
    standby = undefined;
    const warmup = await current.ready;
    const started = Date.now();
    current.child.stdin.write('cook\n');
    const done = await current.waitFor('done');
    await current.exited;
    ensure();
    if (done.code !== 0) throw new Error(`cook failed with code ${done.code}; log: ${current.logFile}`);
    return { seconds: (Date.now() - started) / 1000, warmup, logFile: current.logFile };
  }

  function stop() {
    stopped = true;
    standby?.child.stdin.end();
  }

  return { ensure, cook, stop };
}
