// Evaluates an expression in every Unreal process connected to the dev server and prints the results.
// In scope: UE, puerts, world, gameInstance. The expression may be async.
//   node tools/game.mjs "UE.GameplayStatics.GetPlayerPawn(world, 0).K2_GetActorLocation()"
import { devServerUrl } from './engine.mjs';

const [code, timeoutMs] = process.argv.slice(2);
if (!code) {
  console.error('usage: node tools/game.mjs "<expression>" [timeoutMs]');
  process.exit(1);
}
const response = await fetch(`${devServerUrl()}/__vge/eval`, {
  method: 'POST',
  body: JSON.stringify({ code, timeoutMs: Number(timeoutMs ?? 5000) }),
});
const { clients, results } = await response.json();
if (clients === 0) console.error('no Unreal process is connected to the dev server');
for (const [index, reply] of results.entries()) {
  console.log(`#${index} ${reply.ok ? JSON.stringify(reply.result, null, 2) : `ERROR ${reply.error}`}`);
}
if (results.length < clients) console.error(`${clients - results.length} process(es) did not answer`);
