// Vite dev backend for Unreal runtime processes.
// One Vite server owns file watching, TypeScript transforms, the module graph and HMR for two
// environments: `unreal` (game code; every Unreal process is a ModuleRunner client over WebSocket at
// /__unreal) and the regular browser `client` (the HTML/CSS UI at /ui/, shown in the game by the
// engine's embedded browser with Vite's own HMR client). Both share one HTTP port.
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { makeIdFiltersToMatchWithQuery } from '@rolldown/pluginutils';
import { DevEnvironment, createServer, transformWithOxc } from 'vite';
import { reactRefreshWrapperPlugin } from 'vite/internal';
import { WebSocketServer } from 'ws';
import { createFab } from './content/fab.mjs';
import { createContentPipeline } from './content/pipeline.mjs';
import { ports, runtimeDir, shellSecret } from './tools/engine.mjs';
import { registerRuntimeUse, trackProcess } from './tools/processes.mjs';
import { contentAssetsPlugin } from './vite/contentAssetsPlugin.mjs';
import { devLeanTransportPlugin } from './vite/devLeanTransportPlugin.ts';
import { uiKitClientPlugins, unrealOptimizeDeps, unrealResolve } from './vite/environments.mjs';

const PORT = ports().dev;
const PATH = '/__unreal';

// The game channel and the eval seam run code in the game, so only the kit's own processes may use them: the
// games (Puerts' WebSocket client) and the tools (Node's fetch) send no Origin header, while every request a web
// page makes does, so a page open in any browser while the dev server runs cannot reach them.
const fromAPage = (request) => request.headers.origin !== undefined;

function createUnrealHotChannel() {
  const listeners = new Map();
  const sockets = new Set();
  const wss = new WebSocketServer({ noServer: true });

  const dispatch = (event, data, client) => {
    for (const fn of listeners.get(event) ?? []) fn(data, client);
  };

  wss.on('connection', (socket, request) => {
    sockets.add(socket);
    const client = { send: (payload) => socket.send(JSON.stringify(payload)) };
    console.log(`[vge] unreal client connected from ${request.socket.remoteAddress} (${sockets.size} total)`);
    socket.on('message', (raw) => {
      const payload = JSON.parse(raw.toString());
      if (payload.type === 'custom') dispatch(payload.event, payload.data, client);
    });
    socket.on('close', () => {
      sockets.delete(socket);
      console.log(`[vge] unreal client disconnected (${sockets.size} left)`);
    });
    dispatch('connection');
  });

  return {
    skipFsCheck: false,
    on(event, fn) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(fn);
    },
    off(event, fn) {
      listeners.get(event)?.delete(fn);
    },
    send(payload) {
      const text = JSON.stringify(payload);
      for (const socket of sockets) if (socket.readyState === socket.OPEN) socket.send(text);
    },
    // Takes only upgrades for PATH on the shared HTTP server; Vite's own HMR socket keeps the rest.
    attach(httpServer) {
      httpServer.on('upgrade', (request, socket, head) => {
        if (new URL(request.url, 'http://localhost').pathname !== PATH) return;
        if (fromAPage(request)) {
          socket.end('HTTP/1.1 403 Forbidden\r\n\r\n');
          return;
        }
        wss.handleUpgrade(request, socket, head, (ws) => wss.emit('connection', ws, request));
      });
    },
    listen() {},
    clientCount: () => sockets.size,
    close() {
      for (const socket of sockets) socket.close();
      return new Promise((resolvePromise) => wss.close(() => resolvePromise()));
    },
  };
}

const unrealChannel = createUnrealHotChannel();

// Model files the game code imports become cooked containers; runtimes are told over the unreal hot channel.
const pipeline = createContentPipeline({ projectDir: resolve(process.cwd(), '..') });

function contentPlugins() {
  let unreal;
  const build = (file, key) => {
    console.log(`[content] building ${key}`);
    pipeline.enqueue(file, key, (err, result) => {
      if (err) {
        console.error(`[content] ${err.message}`);
        unreal().send('vge:content-error', { file: key, message: err.message });
      } else {
        unreal().send('vge:content', result.manifest);
      }
    });
  };
  return [
    {
      name: 'vge:content',
      configureServer(server) {
        unrealChannel.attach(server.httpServer);
        unreal = () => server.environments.unreal.hot;
        unreal().on('vge:content-sync', (_data, client) => client.send('vge:content', pipeline.manifest()));
        // The content service warms up with the dev server, so the first imported model does not wait for it.
        pipeline.startService();
      },
    },
    // A model is built when the game code first imports it (unless its last build is current) and on every save.
    contentAssetsPlugin({
      root: process.cwd(),
      onImport: (file, key) => {
        if (pipeline.isStale(file, key)) build(file, key);
      },
      onChange: build,
    }),
  ];
}

// DEV seam: POST /__vge/eval {"code": "<expression>"} evaluates the expression in every connected Unreal
// process (src/app/debug-seam.ts) and answers with their results (tools/game.mjs is the CLI for it).
// Refused to web pages (fromAPage).
function evalPlugin() {
  return {
    name: 'vge:eval',
    configureServer(server) {
      const unreal = () => server.environments.unreal.hot;
      const pending = new Map();
      unreal().on('vge:eval-result', (reply) => pending.get(reply.id)?.(reply));
      server.middlewares.use('/__vge/eval', (req, res) => {
        if (req.method !== 'POST' || fromAPage(req)) {
          res.statusCode = 403;
          res.end();
          return;
        }
        let body = '';
        req.on('data', (chunk) => (body += chunk));
        req.on('end', () => {
          const { code, timeoutMs = 5000 } = JSON.parse(body || '{}');
          const id = Math.random().toString(36).slice(2);
          const expected = unrealChannel.clientCount();
          const results = [];
          const finish = () => {
            pending.delete(id);
            res.setHeader('content-type', 'application/json');
            res.end(JSON.stringify({ clients: expected, results }));
          };
          const timer = setTimeout(finish, timeoutMs);
          pending.set(id, (reply) => {
            results.push(reply);
            if (results.length >= expected) {
              clearTimeout(timer);
              finish();
            }
          });
          if (expected === 0) {
            clearTimeout(timer);
            finish();
          } else {
            unreal().send('vge:eval', { id, code });
          }
        });
      });
    },
  };
}

// The Fab window's calls (shell/src/FabWindow.cpp -> content/fab.mjs), refused to web pages (fromAPage) other than
// the kit's shell, which goes out with an Origin as a browser does and proves itself with X-Vge-Shell (shellSecret):
//   POST /__vge/fab           {"method":"addtoproject","args":[...]} -> one JSON object per line as the call goes:
//                             {"progress":{"stage":"downloading","percent":42}} ..., then {"result":...} or {"error":"..."}
//   POST /__vge/fab/open      {"url":"https://www.fab.com/listings/<id>"}: the shell page opens the Fab window on it
//                             (ui/shell/fab.ts); answers how many pages heard it
//   GET  /__vge/fab/installs  every install from the Fab window, with its state and where it landed (tools/fab.mjs)
//   POST /__vge/fab/pack      {"name":"<Pack>","from":"<folder holding Content/<Pack>>"}: a pack already on disk (the
//                             launcher's VaultCache download) into Content/<Pack> and its container, as Add to Project
// Its middleware goes ahead of the lean transport's, which holds a response back until it ends.
function fabPlugin() {
  return {
    name: 'vge:fab',
    configureServer(server) {
      const unreal = () => server.environments.unreal.hot;
      const fab = createFab({
        projectDir: resolve(process.cwd(), '..'),
        devDir: process.cwd(),
        pipeline,
        broadcast: (manifest) => unreal().send('vge:content', manifest),
        // The shell page's notices (ui/shell/FabNotices.tsx) follow each install.
        notify: (entry) => server.ws.send({ type: 'custom', event: 'vge:fab-install', data: entry }),
      });
      const readJson = (req) =>
        new Promise((resolvePromise) => {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => resolvePromise(JSON.parse(body || '{}')));
        });
      const secret = shellSecret();
      server.middlewares.use('/__vge/fab', async (req, res) => {
        if (fromAPage(req) && req.headers['x-vge-shell'] !== secret) {
          res.statusCode = 403;
          res.end();
          return;
        }
        const path = new URL(req.url, 'http://localhost').pathname;
        if (req.method === 'GET' && path === '/installs') {
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(fab.installs(), null, 2));
          return;
        }
        if (req.method === 'POST' && path === '/open') {
          const { url } = await readJson(req);
          server.ws.send({ type: 'custom', event: 'vge:fab-open', data: { url } });
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ pages: server.ws.clients.size }));
          return;
        }
        if (req.method === 'POST' && path === '/pack') {
          const { name, from } = await readJson(req);
          res.setHeader('content-type', 'application/json');
          try {
            res.end(JSON.stringify(await fab.addPack(name, from)));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }
        if (req.method !== 'POST' || path !== '/') {
          res.statusCode = 404;
          res.end();
          return;
        }
        const { method, args = [] } = await readJson(req);
        res.setHeader('content-type', 'application/x-ndjson');
        res.setHeader('content-encoding', 'identity');
        const line = (value) => res.write(`${JSON.stringify(value)}\n`);
        try {
          line({ result: (await fab.call(method, args, (progress) => line({ progress }))) ?? null });
        } catch (err) {
          line({ error: err.message });
        }
        res.end();
      });
    },
  };
}

// React Fast Refresh for the game code, the browser's own: @vitejs/plugin-react gives it to the `client`
// environment only, and Vite's oxc plugin turns JSX refresh off for any `server` consumer (vite:oxc,
// getModifiedOxcTransformOptions). The same oxc transform with refresh, and the same refresh wrapper
// (vite/internal reactRefreshWrapperPlugin: registers exports, accepts the module, falls back to a reload),
// run here for `unreal`. The runtime is plugin-react's /@react-refresh, whose preamble src/app/refresh.ts runs.
function unrealReactRefresh() {
  const isUnreal = (environment) => environment.name === 'unreal';
  const filter = { include: makeIdFiltersToMatchWithQuery(/\.[tj]sx?$/), exclude: makeIdFiltersToMatchWithQuery(/\/node_modules\//) };
  return [
    {
      name: 'vge:react-refresh-transform',
      enforce: 'pre',
      applyToEnvironment: isUnreal,
      async transform(code, id) {
        const [file] = id.split('?');
        if (!/\.[tj]sx$/.test(file) || file.includes('/node_modules/')) return;
        const result = await transformWithOxc(code, file, { jsx: { runtime: 'automatic', development: true, refresh: true }, sourcemap: true });
        return { code: result.code, map: result.map };
      },
    },
    {
      name: 'vge:react-refresh-wrapper',
      applyToEnvironment: (environment) =>
        isUnreal(environment) && reactRefreshWrapperPlugin({ cwd: process.cwd(), ...filter, jsxImportSource: 'react', reactRefreshHost: '' }),
    },
  ];
}

const server = await createServer({
  configFile: false,
  root: process.cwd(),
  appType: 'mpa',
  logLevel: 'info',
  // The shell's inspection surfaces (the web-starter-kit's lab index and UI-kit gallery) exist in dev only.
  define: { __SHOWCASE_SURFACES__: 'true' },
  plugins: [fabPlugin(), devLeanTransportPlugin({ compress: true, stripSourcemaps: true }), react(), unrealReactRefresh(), uiKitClientPlugins(), contentPlugins(), evalPlugin()],
  server: {
    host: '127.0.0.1',
    port: PORT,
    strictPort: true,
    // Watch only what the runtimes execute; a whole-root watch leaks memory on large trees.
    watch: { ignored: ['**/node_modules/**', '**/.git/**', '**/runner/**', '**/*.log'] },
  },
  environments: {
    unreal: {
      consumer: 'server',
      resolve: unrealResolve,
      optimizeDeps: unrealOptimizeDeps,
      dev: {
        createEnvironment: (name, config) =>
          new DevEnvironment(name, config, { hot: true, transport: unrealChannel, remoteRunner: { inlineSourceMap: false } }),
      },
    },
    client: {
      // The shell page reads the game's lab manifests (ui/app/labs/labRegistry.ts), whose loaders point at game
      // code; the dependency scan follows them, and Puerts' native modules exist only inside the engine.
      optimizeDeps: { exclude: ['ue', 'puerts'] },
    },
  },
});
await server.listen();
trackProcess('dev', process.pid);
registerRuntimeUse(runtimeDir());
console.log(`[vge] waiting for Unreal on ws://127.0.0.1:${PORT}${PATH}; the shell's app is http://127.0.0.1:${PORT}/ (npm run shell)`);

// If this process is killed outright, the service sees its stdin close and exits by itself.
process.on('SIGINT', async () => {
  pipeline.stopService();
  await server.close();
  process.exit(0);
});
