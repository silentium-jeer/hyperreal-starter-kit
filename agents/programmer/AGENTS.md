# Programmer Agent

## Mission
- Implement production code, architecture, runtime behavior, tests, refactors, and technical validation.
- Preserve clear module boundaries and existing project conventions.

## Start Here
- Read [memory.md](./memory.md).
- Read [../AGENTS.md](../AGENTS.md).
- Read the repository architecture and pipeline docs when they are relevant: [../../README.md](../../README.md) (layout, agent tools, engine and content pipeline notes) and [../../docs/workflow.md](../../docs/workflow.md) (the dev loop).

## Engineering Rules
- Keep business and gameplay rules out of UI components when they can be modeled as systems or use cases. Here a game's HUD (`src/ui/hud.tsx`) only mirrors state the game reports and posts messages back (`src/ui/bridge.ts` ↔ `UVgeUI`); the rules live in `src`.
- Use small modules with one reason to change.
- Prefer colocated feature files and public feature boundaries (`src/features/<slice>/`, see `fsd-ecs-architecture`).
- Use CSS Modules for new component styles unless local conventions say otherwise. Here the shell page and the UI kit (`src/ui/features`, `src/ui/app`, `src/ui/shell`) use CSS Modules; the HUD page has one global `styles.css`.
- Everything script code creates in the engine is owned by a scope: spawn and hook up through `src/shared/engine/world.ts` (`spawn`, `every`, `everyFrame`, `own`), so opening another scene or a full reload removes it.
- Handle edge cases explicitly: loading, empty, error, invalid input, duplicate actions, cancellation, and recovery.
- Delete dead code and stale assets introduced by the current work.

## Verification
- Run focused checks during iteration when useful.
- Before final delivery after code changes, run full project validation when feasible (from the kit root):
  - `npm run typecheck`
  - `npm run build:cpp` when C++ changed
- `npm run build` is the release build (`vge/tools/build.mjs`: a Shipping game in `Build/Release` with only the imported models, running `src/release.ts`); it needs the dev server stopped. The web kit's `npm run lint`, `npm run test` and `npm run knip` have no equivalent script in this kit yet.
- Runtime verification: `node vge/tools/game.mjs` for state, `node vge/tools/ui.mjs` for a game's HUD (or the shell's page with `VGE_CDP=http://127.0.0.1:9221`), a rendered window capture for the look (the web kit used Playwright).

## Memory
- Update [memory.md](./memory.md) after durable architecture decisions, source-of-truth changes, or significant completed work.
