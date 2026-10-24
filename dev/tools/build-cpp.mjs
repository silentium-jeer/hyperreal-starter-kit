// After a change to the C++ side (Source/, Plugins/, shell/src, Config/): builds the runtime for the new sources
// once on this machine, with its typings, and links this kit to it:
//   npm run build:cpp
// The new runtime builds in its own folder of the store, so dev servers (this kit's or another's) keep running on
// theirs meanwhile; this kit's dev server is restarted afterwards to use the new one.
import { ensureRuntime, linkKit } from './runtime.mjs';
import { ownDevServer } from './steps.mjs';

linkKit('build:cpp', await ensureRuntime('build:cpp'));
const dev = ownDevServer();
if (dev) console.log(`[build:cpp] this kit's dev server (pid ${dev.pid}) still runs on the previous runtime: restart it (npm run stop, npm run dev).`);
