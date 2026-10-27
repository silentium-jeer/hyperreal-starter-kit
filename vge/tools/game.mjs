// Evaluates an expression in the Unreal processes connected to the dev server and prints the results.
// In scope: UE, puerts, world, gameInstance. The expression may be async.
//   node vge/tools/game.mjs "UE.GameplayStatics.GetPlayerPawn(world, 0).K2_GetActorLocation()"
//   node vge/tools/game.mjs --scene labs/playground "<expression>"   only the world on that scene (the shell's worlds
//                                                                     are one process per scene: npm run open)
// Each answer names its process's scene and its HUD's DevTools port (tools/ui.mjs with VGE_CDP=http://127.0.0.1:<port>).
import { parseArgs } from 'node:util';
import { devServerUrl } from './engine.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { scene: { type: 'string' } } });
const [code, timeoutMs] = positionals;
if (!code) {
  console.error('usage: node vge/tools/game.mjs [--scene <main|labs/<id>>] "<expression>" [timeoutMs]');
  process.exit(1);
}
const response = await fetch(`${devServerUrl()}/__vge/eval`, {
  method: 'POST',
  body: JSON.stringify({ code, timeoutMs: Number(timeoutMs ?? 5000), ...(values.scene ? { scene: values.scene } : {}) }),
});
const { clients, results } = await response.json();
if (clients === 0) console.error('no Unreal process is connected to the dev server');
const answered = results.filter((reply) => !reply.skipped);
if (clients > 0 && values.scene && answered.length === 0 && results.length === clients) {
  console.error(`no world is on scene ${values.scene}; open it in the shell with: npm run open -- ${values.scene}`);
}
for (const [index, reply] of answered.entries()) {
  const where = `[${reply.scene ?? '?'}${reply.cdp ? `, HUD DevTools ${reply.cdp}` : ''}]`;
  console.log(`#${index} ${where} ${reply.ok ? JSON.stringify(reply.result, null, 2) : `ERROR ${reply.error}`}`);
}
if (results.length < clients) console.error(`${clients - results.length} process(es) did not answer`);
