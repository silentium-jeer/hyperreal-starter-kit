// Runs inside Unreal (Puerts / V8). Connects to the Vite dev server and executes the entry
// module through Vite's ModuleRunner, so every module gets Vite transforms and HMR.
import './polyfills';
import { ESModulesEvaluator, ModuleRunner } from 'vite/module-runner';

declare const require: (id: string) => any;

const puerts = require('puerts');
const UE = require('ue');
const gameInstance = puerts.argv.getByName('GameInstance');

// Native modules provided by Puerts. Vite externalizes them and the runner asks the evaluator for them.
const nativeModules: Record<string, () => any> = {
  ue: () => UE,
  puerts: () => puerts,
};

// Vite checks named imports with `name in module`; the lazy `ue` namespace resolves classes on access only
// and throws for unknown names, so promise resolution probing `then` and symbol keys must not reach it.
function asNamespace(target: any) {
  return new Proxy(target, {
    has: () => true,
    get: (obj, key) => {
      if (key === Symbol.toStringTag) return 'Module';
      if (typeof key === 'symbol' || key === 'then') return undefined;
      return obj[key];
    },
  });
}

class PuertsEvaluator extends ESModulesEvaluator {
  async runExternalModule(id: string) {
    const make = nativeModules[id];
    if (!make) throw new Error(`[vge] external module '${id}' is not available inside Unreal`);
    return asNamespace(make());
  }
}

const devServerUrl: string = gameInstance.DevServerUrl;
const entry: string = gameInstance.EntryModule;
const t0 = gameInstance.SecondsSinceProcessStart();

// WebSocket transport that survives a dev server restart: it reconnects, holds messages sent meanwhile,
// and then reloads the program the way Vite's browser client reloads the page after a restart, because the
// new server has a fresh module graph and the old module instances cannot receive its updates.
function createReconnectingTransport(url: string) {
  let socket: WebSocket | undefined;
  let handlers: { onMessage: (payload: any) => void } | undefined;
  const queued: string[] = [];
  let everConnected = false;
  let closing = false;

  const open = () =>
    new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(url);
      let opened = false;
      ws.addEventListener('open', () => {
        opened = true;
        socket = ws;
        for (const text of queued.splice(0)) ws.send(text);
        const reconnected = everConnected;
        everConnected = true;
        resolve();
        if (reconnected) {
          console.log(`[vge] reconnected to ${url}, reloading program`);
          handlers?.onMessage({ type: 'full-reload' });
        }
      });
      ws.addEventListener('message', ({ data }: any) => handlers?.onMessage(JSON.parse(data)));
      ws.addEventListener('close', () => {
        if (!opened) return reject(new Error(`could not connect to ${url}`));
        socket = undefined;
        if (!closing) {
          console.warn(`[vge] lost dev server ${url}, retrying`);
          retry();
        }
      });
    });

  const retry = () => setTimeout(() => open().catch(retry), 1000);

  return {
    async connect(h: { onMessage: (payload: any) => void }) {
      handlers = h;
      await open().catch(() => new Promise<void>((resolve) => {
        const attempt = () => open().then(resolve, () => setTimeout(attempt, 1000));
        setTimeout(attempt, 1000);
      }));
    },
    send(data: unknown) {
      const text = JSON.stringify(data);
      if (socket) socket.send(text);
      else queued.push(text);
    },
    disconnect() {
      closing = true;
      socket?.close();
    },
  };
}

const runner = new ModuleRunner(
  {
    transport: createReconnectingTransport(devServerUrl),
    sourcemapInterceptor: false,
    // Puerts' console has no `debug`.
    hmr: { logger: { debug: (...args: any[]) => console.log(...args), error: (err: any) => console.error(String(err?.stack ?? err)) } },
  },
  new PuertsEvaluator(),
);

(globalThis as any).__vge = { runner, gameInstance };

console.log(`[vge] connecting to ${devServerUrl}, entry ${entry}`);
runner
  .import(entry)
  .then(() => {
    const t1 = gameInstance.SecondsSinceProcessStart();
    console.log(`[vge] entry ready at ${t1.toFixed(3)} s (script part ${(t1 - t0).toFixed(3)} s)`);
  })
  .catch((err: any) => console.error(`[vge] entry failed: ${err?.stack ?? err}`));
