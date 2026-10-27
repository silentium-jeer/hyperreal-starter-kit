// @ts-expect-error served by @vitejs/plugin-react, no typings
import { injectIntoGlobalHook } from '/@react-refresh';

const global = globalThis as any;
injectIntoGlobalHook(global);
global.$RefreshReg$ = () => {};
global.$RefreshSig$ = () => (type: unknown) => type;

const hook = global.__REACT_DEVTOOLS_GLOBAL_HOOK__;
if (!hook.recordsRenderers) {
  const injectWithoutRecording = hook.inject;
  hook.inject = function recordRenderer(this: unknown, internals: unknown) {
    const id = injectWithoutRecording.call(this, internals);
    hook.renderers.set(id, internals);
    return id;
  };
  hook.recordsRenderers = true;
}
