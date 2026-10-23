// The release game: `npm run build` -> Build/Release/Windows/VibeGameEngine.exe.
// What goes in is what the program imports, as in any Vite build:
//   1. Vite bundles src/release.ts and everything it imports into Content/JavaScript/vge/game.js, and the UI
//      into Content/UI. Each model file the bundle imports (vite/contentAssetsPlugin.mjs) is imported by the
//      content service into /Game/Vge/Imported/<folder>/<Name>, and its objects' paths go into the bundle.
//   2. BuildCookRun stages the shared runtime's Shipping game (which runs game.js, UVgeGameInstance) and cooks the base content
//      plus /Game/Vge/Imported (Config/DefaultGame.ini), so a model nothing imports is not in the game.
//   3. The imported content, the bundle and the UI page are removed again, so a dev package never has them.
// The dev server must be stopped: the build uses the content service and the editor target's DLLs itself.
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import react from '@vitejs/plugin-react';
import { createBuilder } from 'vite';
import { createContentService } from '../content/service.mjs';
import { assetName, createDecoder } from '../content/decode.mjs';
import { contentAssetsPlugin } from '../vite/contentAssetsPlugin.mjs';
import { uiKitClientPlugins, unrealResolve } from '../vite/environments.mjs';
import { engine, project, repoRoot } from './engine.mjs';
import { refuseWhileDevServerRuns, step } from './steps.mjs';

const TAG = 'build';
const IMPORTED = '/Game/Vge/Imported';
const devDir = join(repoRoot, 'dev');
const importedDir = join(repoRoot, 'Content', 'Vge', 'Imported');
const scriptDir = join(repoRoot, 'Content', 'JavaScript', 'vge');
const bundle = join(scriptDir, 'game.js');
const uiDir = join(repoRoot, 'Content', 'UI');
const workDir = join(repoRoot, 'Saved', 'Release');
const archive = join(repoRoot, 'Build', 'Release');

function removeReleaseInputs() {
  rmSync(importedDir, { recursive: true, force: true });
  rmSync(bundle, { force: true });
  rmSync(uiDir, { recursive: true, force: true });
}

await refuseWhileDevServerRuns();
const started = Date.now();
removeReleaseInputs();
// 3. Nothing of the release stays in the project's content, whether the build finishes, a step exits early or it
// is interrupted (Ctrl+C ends a Node process without 'exit' unless SIGINT is handled; process.exit raises it).
// Left behind, they would go into the next dev package: Config/DefaultGame.ini stages Content/UI and cooks
// /Game/Vge/Imported whenever they exist.
process.on('exit', removeReleaseInputs);
process.on('SIGINT', () => process.exit(130));
mkdirSync(workDir, { recursive: true });

// 1. Program, UI and the models the program imports.
const { editorCmd } = engine();
const service = createContentService({ editorCmd, project, logFile: join(workDir, 'content-service.log') });
const decode = createDecoder();
const imported = [];
// src/features/demo/assets/flight-case.glb -> /Game/Vge/Imported/src/features/demo/assets/FlightCase
const destOf = (key) => [IMPORTED, ...dirname(key).split('/').filter((part) => part !== '.').map((part) => part.replace(/[^A-Za-z0-9_]/g, '_')), assetName(key)].join('/');

const builder = await createBuilder({
  configFile: false,
  root: devDir,
  base: './',
  logLevel: 'info',
  plugins: [
    react(),
    uiKitClientPlugins(),
    contentAssetsPlugin({
      root: devDir,
      onImport: async (file, key) => {
        const decoded = await decode(file, join(workDir, key.replace(/\.[^.]+$/, '.glb')));
        const result = await service.call('import', { source: decoded.file, dest: destOf(key) });
        console.log(`[${TAG}] ${key} -> ${destOf(key)} (${result.objects.length} objects)`);
        imported.push(key);
        return result.objects;
      },
    }),
  ],
  environments: {
    unreal: {
      consumer: 'server',
      resolve: unrealResolve,
      // Bare V8 inside the engine has no `process`.
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      build: {
        outDir: scriptDir,
        emptyOutDir: false,
        minify: true,
        rolldownOptions: {
          input: join(devDir, 'src', 'release.ts'),
          // Platform "neutral" for the reason the dev server's dependency optimizer uses it (vite/environments.mjs).
          platform: 'neutral',
          // Puerts loads one CommonJS file and gives it `require` for its native modules.
          output: { format: 'cjs', entryFileNames: 'game.js', inlineDynamicImports: true },
        },
      },
    },
    client: {
      build: {
        outDir: uiDir,
        emptyOutDir: true,
        // The world HUD only: the shell (ui/index.html) is a dev surface.
        rolldownOptions: { input: join(devDir, 'ui', 'hud.html') },
      },
    },
  },
  builder: {},
});
try {
  await builder.buildApp();
} finally {
  // The service holds the editor target's DLLs, which BuildCookRun rebuilds if they are out of date.
  await service.stop();
}
if (!existsSync(bundle)) {
  console.error(`[${TAG}] the bundle ${bundle} was not written`);
  process.exit(1);
}
console.log(`[${TAG}] program bundled with ${imported.length} imported model file(s): ${imported.join(', ') || 'none'}`);

// 2. The Shipping game with the cooked base content and the imported models.
step(TAG, 'shipping game', engine().runUat, [
  'BuildCookRun',
  `-project="${project}"`,
  '-noP4',
  '-platform=Win64',
  '-clientconfig=Shipping',
  '-cook',
  '-stage',
  '-pak',
  '-iostore',
  '-nodebuginfo',
  '-archive',
  `-archivedirectory="${archive}"`,
  '-unattended',
]);
console.log(`[${TAG}] ${join(archive, 'Windows', 'VibeGameEngine.exe')} in ${((Date.now() - started) / 60000).toFixed(1)} min`);
