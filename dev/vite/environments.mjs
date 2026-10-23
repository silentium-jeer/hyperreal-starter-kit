// What the dev server (server.mjs) and the release build (tools/build.mjs) configure the same way.
// The web-starter-kit's own plugin, copied unchanged: its UI kit (dev/ui/features/bootstrap) imports
// `virtual:bootstrap-assets`. Loaded through Node's TypeScript type stripping.
import { bootstrapAssetRegistryPlugin } from './bootstrapAssetRegistryPlugin.ts';

// The `unreal` environment's module resolution: native modules provided by Puerts exist on no disk (the dev
// runner gets them from its evaluator, the release bundle from Puerts' require), everything else is bundled.
export const unrealResolve = { builtins: ['ue', 'puerts'], noExternal: true };

// React and its reconciler ship as CommonJS; the dependency optimizer turns them into ES modules the in-engine
// ModuleRunner can evaluate. Platform "neutral": a server environment defaults to "node", whose CommonJS
// interop imports node:module, which V8 inside the engine does not have.
export const unrealOptimizeDeps = {
  include: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-reconciler', 'react-reconciler/constants', 'scheduler'],
  rolldownOptions: { platform: 'neutral' },
};

// Client-environment settings the web-starter-kit app needs (dev/ui: the shell page and the world HUD page).
const isClient = (environment) => environment.name === 'client';
export function uiKitClientPlugins() {
  return [
    { ...bootstrapAssetRegistryPlugin({ entry: '/ui/main.tsx' }), applyToEnvironment: isClient },
    // The shell page is the web-starter-kit's app, routed by react-router at the server root (/, /labs/<id>,
    // /ui-kit/<component>), so a page load of any such path gets its index.html, as the web kit's SPA server
    // does. Files (/ui/hud.html, modules, assets) and the dev server's own endpoints are served as they are.
    {
      name: 'vge:ui-spa-fallback',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          const pathname = new URL(req.url, 'http://localhost').pathname;
          const wantsHtml = req.method === 'GET' && (req.headers.accept ?? '').includes('text/html');
          const ownPath = /^\/(@|__)/.test(pathname) || /\.[^/]*$/.test(pathname);
          if (wantsHtml && !ownPath) req.url = '/ui/index.html';
          next();
        });
      },
    },
  ];
}
