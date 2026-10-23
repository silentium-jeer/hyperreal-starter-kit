// Frame rate of every game connected to the dev server, measured over every frame for a few seconds:
//   node tools/fps.mjs [seconds=5]
// Prints per game: average fps, 1% low fps (the average of the slowest 1% of frames), and frame time.
const seconds = Number(process.argv[2] ?? 5);
const port = process.env.VGE_PORT ?? 5173;
const code = `new Promise((resolve) => {
  const deltas = [];
  const tick = (dt) => deltas.push(dt);
  gameInstance.OnTick.Add(tick);
  setTimeout(() => {
    gameInstance.OnTick.Remove(tick);
    const sorted = [...deltas].sort((a, b) => b - a);
    const slowest = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 100)));
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const low = slowest.reduce((a, b) => a + b, 0) / slowest.length;
    resolve({ frames: deltas.length, fps: +(1 / mean).toFixed(1), low1: +(1 / low).toFixed(1), frameMs: +(mean * 1000).toFixed(2) });
  }, ${seconds * 1000});
})`;
const response = await fetch(`http://127.0.0.1:${port}/__vge/eval`, {
  method: 'POST',
  body: JSON.stringify({ code, timeoutMs: seconds * 1000 + 5000 }),
});
const { clients, results } = await response.json();
if (!clients) console.error('no game is connected to the dev server');
for (const [index, reply] of results.entries()) console.log(`#${index} ${reply.ok ? JSON.stringify(reply.result) : `ERROR ${reply.error}`}`);
