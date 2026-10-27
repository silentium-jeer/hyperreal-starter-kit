import { DEFAULT_FRAME_RATE_LIMIT, setFrameRateLimit } from '../shared/engine/display';
import { initialScene, openScene } from './scenes';
import { mountUIHost } from './ui-host';

setFrameRateLimit(DEFAULT_FRAME_RATE_LIMIT);
mountUIHost();
openScene(initialScene()).catch((err: any) => console.error(`[scenes] opening the first scene failed: ${err?.stack ?? err}`));
