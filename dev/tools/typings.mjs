// Regenerates Typing/ue (ue.d.ts, ue-jsx.d.ts, ue-jsx.json) in the linked runtime from the engine's reflection: npm run typings
import { runtimeDir } from './engine.mjs';
import { typings } from './steps.mjs';

typings('typings', runtimeDir());
