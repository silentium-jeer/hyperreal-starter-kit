import './app/refresh';
import { mountDebugSeam } from './app/debug-seam';
import './app/program';

// Dev entry, run by the in-engine bootstrap through the dev server and re-run on every full reload:
// React Fast Refresh, the debug seam, then the program.
mountDebugSeam();
