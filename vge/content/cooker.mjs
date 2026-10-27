// Stock cook processes (VgeCook commandlet), up to `count` cooking at once. One is kept warmed up in standby, so the
// engine has already started when a build needs a cook; each process runs one cook, and the first slot starts its
// next standby process as soon as it is released. The other slots start a process only for a cook that finds the
// first one busy, and keep none in standby: an idle cook process holds about 1.7 GB, and three per dev server left a
// game starting beside them short of memory (engine start 27 s instead of 2.4 s, 2026-10-27).
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

export function createStandbyCooker({ editorCmd, project, cookArgs, logDir, count = 1, log = console.log }) {
  let sequence = 0;
  let stopped = false;
  // One slot per process that may cook at the same time; `standby` is its warmed-up process, `busy` while it cooks.
  const slots = Array.from({ length: count }, () => ({ standby: undefined, busy: false }));
  const waiting = [];

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

  function warm(slot) {
    if (!slot.standby && !stopped) {
      slot.standby = launch();
      slot.standby.ready.then((seconds) => log(`[cooker] standby ready in ${seconds.toFixed(1)} s`), () => {});
    }
    return slot.standby;
  }

  function ensure() {
    warm(slots[0]);
  }

  // A free slot, waiting for one when every process is cooking.
  function takeSlot() {
    const free = slots.find((slot) => !slot.busy);
    if (free) {
      free.busy = true;
      return Promise.resolve(free);
    }
    return new Promise((resolve) => waiting.push(resolve));
  }

  function releaseSlot(slot) {
    const next = waiting.shift();
    if (next) next(slot);
    else slot.busy = false;
  }

  // Runs one cook in a standby process: `args` are added to its cook arguments (the output folder, an asset pack's
  // -COOKDIR=), `scan` are content paths created after the process started that the cook must see (VgeCook rescans
  // them), `folders` the content folders a DLC cook is limited to (VgeAssetManager.h). Returns { seconds, warmup,
  // waited, logFile }.
  async function cook({ args = [], scan = [], folders = [] } = {}) {
    const asked = Date.now();
    const slot = await takeSlot();
    const current = warm(slot);
    slot.standby = undefined;
    try {
      const warmup = await current.ready;
      const started = Date.now();
      // Time this cook waited for a free process and for it to finish starting.
      const waited = (started - asked) / 1000;
      current.child.stdin.write(`${JSON.stringify({ args, scan, folders })}\n`);
      const done = await current.waitFor('done');
      if (done.code !== 0) throw new Error(`cook failed with code ${done.code}; log: ${current.logFile}`);
      return { seconds: (Date.now() - started) / 1000, warmup, waited, logFile: current.logFile };
    } finally {
      // 'done' comes after the cook has written everything (VgeCookCommandlet.cpp); the process takes another ~0.6 s
      // to shut down its shader workers and exit, which the build does not wait for. The first slot's next standby
      // process starts once it is gone.
      current.exited.then(() => {
        if (slot === slots[0]) warm(slot);
        releaseSlot(slot);
      });
    }
  }

  function stop() {
    stopped = true;
    for (const slot of slots) slot.standby?.child.stdin.end();
  }

  return { ensure, cook, stop };
}
