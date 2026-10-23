// Reports what this machine has and lacks for the kit, without building anything: npm run doctor [-- --json]
// Each missing requirement comes with the command that fixes it. Exit code 1 when anything is missing.
import { checkAll } from './prereqs.mjs';

const results = checkAll();
if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results, null, 2));
} else {
  for (const r of results) {
    console.log(`${r.ok ? ' ok ' : 'MISS'}  ${r.name.padEnd(15)} ${r.detail}`);
    if (!r.ok) console.log(`      ${''.padEnd(15)} fix: ${r.fix}`);
  }
}
process.exit(results.every((r) => r.ok) ? 0 : 1);
