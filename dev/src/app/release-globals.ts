import '../../runner/polyfills';
import * as puerts from 'puerts';

// What the dev bootstrap (runner/bootstrap.ts) gives the program before it runs, for the release bundle:
// the web APIs bare V8 lacks and the `__vge` global with the game instance. Imported first by src/release.ts.
(globalThis as any).__vge = { gameInstance: (puerts as any).argv.getByName('GameInstance') };
