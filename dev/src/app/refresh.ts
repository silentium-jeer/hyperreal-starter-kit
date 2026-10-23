// @ts-expect-error served by @vitejs/plugin-react, no typings
import { injectIntoGlobalHook } from '/@react-refresh';

// React Fast Refresh preamble, the one plugin-react puts in index.html, for the engine's V8 (`window` comes from
// runner/polyfills.ts). It must run before any module that uses React: the refresh runtime finds renderers
// through the DevTools hook it installs here.
const global = globalThis as any;
injectIntoGlobalHook(global);
global.$RefreshReg$ = () => {};
global.$RefreshSig$ = () => (type: unknown) => type;
