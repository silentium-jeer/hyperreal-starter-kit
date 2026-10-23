import { initialScene, openScene } from './scenes';
import { mountUIHost } from './ui-host';

// The game program, the same in the dev server (src/main.ts) and in the release build (src/release.ts):
// the UI host, then the scene named by -Scene= (default "main").
mountUIHost();
openScene(initialScene()).catch((err: any) => console.error(`[scenes] opening the first scene failed: ${err?.stack ?? err}`));
