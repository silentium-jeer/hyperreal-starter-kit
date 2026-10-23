// Measures the hot path inside a running game: rewrites the spinning-cubes lab with a different cube count, then
// waits for the game log line "hot updated: /src/features/demo/labs/spinning-cubes/index.tsx" (React Fast
// Refresh applied the module). Latency = that line's log time - the time the file write finished.
//   node tools/measure-hmr.mjs <game log path> [runs]     (the game shows labs/spinning-cubes)
import { readFileSync, writeFileSync } from 'node:fs';

const [logPath, runsArg = '5'] = process.argv.slice(2);
if (!logPath) throw new Error('usage: node tools/measure-hmr.mjs <game log path> [runs]');
const labPath = new URL('../src/features/demo/labs/spinning-cubes/index.tsx', import.meta.url);
const original = readFileSync(labPath, 'utf8');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MARK = 'hot updated: /src/features/demo/labs/spinning-cubes/index.tsx';

// Unreal log lines start with the UTC time: [2026.10.23-13.31.09:904]
function logTime(line) {
  const m = /^\[(\d+)\.(\d+)\.(\d+)-(\d+)\.(\d+)\.(\d+):(\d+)\]/.exec(line);
  return m && Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +m[7]);
}

const results = [];
try {
  for (let run = 0; run < Number(runsArg); run++) {
    const seen = readFileSync(logPath, 'utf8').split('\n').filter((l) => l.includes(MARK)).length;
    writeFileSync(labPath, original.replace('<SpinningCubes at={[0, 0, 100]} />', `<SpinningCubes at={[0, 0, 100]} count={${3 + (run % 4)}} />`));
    const written = Date.now();
    let line;
    for (let waited = 0; waited < 10000 && !line; waited += 20) {
      await sleep(20);
      line = readFileSync(logPath, 'utf8').split('\n').filter((l) => l.includes(MARK))[seen];
    }
    if (!line) throw new Error(`run ${run}: no "${MARK}" in ${logPath}`);
    results.push(logTime(line) - written);
    await sleep(500);
  }
} finally {
  writeFileSync(labPath, original);
}
const sorted = [...results].sort((a, b) => a - b);
console.log(JSON.stringify({ runs: results, median_ms: sorted[Math.floor(sorted.length / 2)], max_ms: sorted.at(-1) }));
