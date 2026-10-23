// Bundles the in-engine bootstrap (ModuleRunner client) into a single CommonJS file that Puerts loads.
import { build } from 'esbuild';

await build({
  entryPoints: ['runner/bootstrap.ts'],
  outfile: '../Content/JavaScript/vge/bootstrap.js',
  bundle: true,
  format: 'cjs',
  platform: 'neutral',
  target: 'es2022',
  mainFields: ['module', 'main'],
  external: ['puerts', 'ue'],
  logLevel: 'info',
});
