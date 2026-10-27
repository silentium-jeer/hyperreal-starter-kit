// Bundles the in-engine bootstrap (ModuleRunner client) into a single CommonJS file that Puerts loads.
import { build } from 'esbuild';
import { join } from 'node:path';

await build({
  entryPoints: [join(import.meta.dirname, 'runner', 'bootstrap.ts')],
  outfile: join(import.meta.dirname, '..', 'unreal', 'Content', 'JavaScript', 'vge', 'bootstrap.js'),
  bundle: true,
  format: 'cjs',
  platform: 'neutral',
  target: 'es2022',
  mainFields: ['module', 'main'],
  external: ['puerts', 'ue'],
  logLevel: 'info',
});
