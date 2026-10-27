// Opens a scene in the shell the human has open (the dev session, npm run dev), instead of a game process of one's own:
//   npm run open -- labs/playground      a lab
//   npm run open -- main                 the shell's main screen, whatever scene the game puts there
// Waits until the world on that scene answers, then prints how to reach it: game.mjs --scene for its game state,
// its HUD's DevTools port for tools/ui.mjs.
import { devServerUrl } from './engine.mjs';

const scene = process.argv[2] ?? 'main';
const timeoutMs = Number(process.argv[3] ?? 60000);
const post = (path, body) => fetch(`${devServerUrl()}${path}`, { method: 'POST', body: JSON.stringify(body) }).then((r) => r.json());

let opened;
try {
  opened = await post('/__vge/shell/open', { scene });
} catch {
  console.error('the dev server is not running: start the dev session with npm run dev');
  process.exit(1);
}
if (opened.pages === 0) {
  console.error('no shell page is connected to the dev server: open it with npm run shell');
  process.exit(1);
}

// A lab's world is on scene labs/<id>; the main screen's on the game's main scene (src/ui/features/world GameScreen).
const isLab = scene.startsWith('labs/');
const started = Date.now();
for (;;) {
  const { results } = await post('/__vge/eval', { code: '1', ...(isLab ? { scene } : {}), timeoutMs: 2000 });
  // A world answers before its scene is open (scene null): it is waited for.
  const world = results.find((reply) => !reply.skipped && reply.ok && reply.scene && (isLab || !reply.scene.startsWith('labs/')));
  if (world) {
    console.log(`${world.scene} is open in the shell (${Date.now() - started} ms)`);
    console.log(`  game state: node vge/tools/game.mjs --scene ${world.scene} "<expression>"`);
    if (world.cdp) console.log(`  HUD:        VGE_CDP=http://127.0.0.1:${world.cdp} node vge/tools/ui.mjs text`);
    break;
  }
  if (Date.now() - started > timeoutMs) {
    console.error(`${scene} did not open in ${timeoutMs} ms; the shell page shows why (VGE_CDP=http://127.0.0.1:<shell port> node vge/tools/ui.mjs console)`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}
