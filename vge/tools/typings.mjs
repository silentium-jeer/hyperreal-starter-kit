// Regenerates Typing/ue (ue.d.ts, ue-jsx.d.ts, ue-jsx.json) from the engine's reflection, in the build tree, and puts
// it into the linked runtime: npm run typings
import { cpSync } from 'node:fs';
import { join } from 'node:path';
import { runtimeDir } from './engine.mjs';
import { inBuildTree } from './runtime.mjs';
import { typings } from './steps.mjs';

const dir = runtimeDir();
await inBuildTree('typings', (root) => {
  typings('typings', root);
  cpSync(join(root, 'Typing'), join(dir, 'Typing'), { recursive: true });
});
