import '../../vge/runner/polyfills';
import * as puerts from 'puerts';

(globalThis as any).__vge = { gameInstance: (puerts as any).argv.getByName('GameInstance') };
