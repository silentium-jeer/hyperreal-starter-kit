// Stops the processes this kit started, and only those: other kits (the main checkout, profiles) keep running.
//   npm run stop             the dev server, games and shell of this kit
//   npm run stop -- game     only its games (also: dev, shell)
import { stopOwnProcesses } from './processes.mjs';

const kinds = process.argv.slice(2);
const stopped = stopOwnProcesses(kinds.length ? kinds : undefined);
console.log(stopped.length ? stopped.map((entry) => `[stop] ${entry.kind} pid ${entry.pid}`).join('\n') : '[stop] nothing of this kit is running');
