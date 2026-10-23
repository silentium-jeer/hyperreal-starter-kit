// After a change to the C++ side (Source/, Plugins/, shell/src, Config/): builds the runtime for the new sources
// once on this machine, with its typings, and links this kit to it:
//   npm run build:cpp
// The dev server must be stopped first: its content service holds the editor module DLLs.
import { ensureRuntime, linkKit } from './runtime.mjs';
import { refuseWhileDevServerRuns } from './steps.mjs';

await refuseWhileDevServerRuns();
linkKit('build:cpp', await ensureRuntime('build:cpp'));
