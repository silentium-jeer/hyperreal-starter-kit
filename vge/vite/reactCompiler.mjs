// React Compiler for the game code and the UI, as the web starter kit has it (its vite.config.ts: babel with
// @vitejs/plugin-react's reactCompilerPreset): components and hooks are memoized by the compiler, so a state change
// re-renders what reads it, not every component under it. The stock preset applies to `client` consumers only
// (@vitejs/plugin-react reactCompilerPreset applyToEnvironmentHook); the game's `unreal` environment is a server
// consumer, so this preset is the same one with that environment added. It runs ahead of the game's oxc refresh
// transform (server.mjs unrealReactRefresh), on the source with its JSX.
import babel from '@rolldown/plugin-babel';

// The stock preset's filter: code that may declare a component or a hook.
const COMPONENT_OR_HOOK = /forwardRef|memo|(?:const|let|var|function)\s+(?:[A-Z]|use[A-Z0-9])|(?:[A-Z]|use[A-Z0-9])[^\s:=(){}[\],;]*\s*(?:\(|[:=]\s*(?:function|\())/;

export function reactCompilerPlugin() {
  return babel({
    presets: [{
      preset: () => ({ plugins: [['babel-plugin-react-compiler', {}]] }),
      rolldown: {
        filter: { id: { exclude: /\/node_modules\// }, code: COMPONENT_OR_HOOK },
        applyToEnvironmentHook: (environment) => environment.config.consumer === 'client' || environment.name === 'unreal',
        optimizeDeps: { include: ['react/compiler-runtime'] },
      },
    }],
  });
}
