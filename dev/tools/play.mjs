// Starts a game process against the running dev server.
//   npm run play                         the main scene in a window, UI DevTools on 9222
//   npm run play -- --scene labs/physics a scene or lab
//   npm run play -- --lab physics --headless   an agent's isolated lab process without rendering
// Each process logs to Saved/Logs/play-<scene>-<time>.log next to the project.
// The shell (`npm run shell`, shell/src) starts the same process for each scene its page shows.
import { parseArgs } from 'node:util';
import { startGame } from './game-process.mjs';

const { values } = parseArgs({
  options: {
    scene: { type: 'string' },
    lab: { type: 'string' },
    headless: { type: 'boolean', default: false },
    width: { type: 'string', default: '1280' },
    height: { type: 'string', default: '720' },
    cdp: { type: 'string', default: '9222' },
  },
});

const { width, height, cdp, headless } = values;
const scene = values.lab ? `labs/${values.lab}` : (values.scene ?? 'main');
const { child, log } = startGame({ name: `play-${scene.replace(/\//g, '-')}`, scene, headless, width, height, cdp });
console.log(`started ${scene}${headless ? ' (headless)' : ''}, pid ${child.pid}, log ${log}`);
