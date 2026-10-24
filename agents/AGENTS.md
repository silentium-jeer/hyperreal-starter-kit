# Multi-Agent Workflow

## Scope
- This file is the source of truth for repository-level agent routing, workflow, memory, handoff, and validation rules.
- These instructions are game-oriented, but they must not depend on one specific game, setting, mechanic, platform, or store.
- After choosing a role, stay in that role until the task is complete or the user explicitly asks to switch roles.

## Available Agent Roles
- Manager: [manager/AGENTS.md](./manager/AGENTS.md)
- Programmer: [programmer/AGENTS.md](./programmer/AGENTS.md)
- System designer: [system-design/AGENTS.md](./system-design/AGENTS.md)
- Product designer: [product-design/AGENTS.md](./product-design/AGENTS.md)
- Game designer: [game-design/AGENTS.md](./game-design/AGENTS.md)
- Narrative designer: [narrative-design/AGENTS.md](./narrative-design/AGENTS.md)
- Motion designer: [motion-design/AGENTS.md](./motion-design/AGENTS.md)
- Platform publishing: [platform-publishing/AGENTS.md](./platform-publishing/AGENTS.md)
- Optimization engineer: [optimization/AGENTS.md](./optimization/AGENTS.md)
- SMM strategist: [smm/AGENTS.md](./smm/AGENTS.md)

## Start Here
- Read [memory.md](./memory.md) before noticeable work.
- Choose the leading role for the task.
- Read the selected role's `AGENTS.md` and local `memory.md`.
- Use [WORKFLOW.md](./WORKFLOW.md) for task lifecycle, handoff, and verification flow.

## Role Selection
- Choose `manager` for routing, coordination, scope, task framing, handoff, and final readiness decisions.
- Choose `programmer` for code, architecture, runtime behavior, bugs, refactors, UI implementation, tests, and validation.
- Choose `system-design` for engineering specs, module boundaries, contracts, edge cases, data flow, and implementation handoff.
- Choose `product-design` for UX behavior, screen states, flows, interaction rules, feedback, and product-facing acceptance criteria.
- Choose `game-design` for game rules, core loop, mechanics, rewards, progression, balance, meta systems, and gameplay invariants.
- Choose `narrative-design` for story, characters, tone of voice, naming, dialogue, lore, onboarding text, and narrative framing.
- Choose `motion-design` for animation intent, timing, easing, feedback, transitions, ceremony, and reduced-motion strategy.
- Choose `platform-publishing` for release readiness, metadata, platform compliance, package requirements, submission, and store blockers.
- Choose `optimization` for frame cost, stutter, dropped frames, memory growth, draw calls, profiling, performance regressions, and any claim that something is slow. The role owns the measurement and the cause; it hands the code change to `programmer` when the fix is larger than the localization.
- Choose `smm` for social-media strategy, audience research, content systems, hooks, attention retention, media publication rules, community loops, and social performance experiments.

## Programmer Role Gate
- Before choosing `programmer` as the leading role, explicitly answer all three questions:
  1. **Is there a design?**
  2. **Is every implementation question settled?**
  3. **Has every UX and UI case been thought through, edge cases included?**
- The `programmer` role is allowed only when every answer is an evidence-backed **yes**.
- If any answer is **no**, uncertain, assumed, or unsupported, the leading role must be one of the relevant design/project roles (`manager`, `system-design`, `product-design`, `game-design`, `narrative-design`, or `motion-design`). Resolve the missing decisions in that role before switching to `programmer`.
- A user request to “implement”, “build”, or “write code” does not bypass this gate when design, realization, UX, or UI decisions are still open.

## No Silent Role Drift
- Do not silently mix roles.
- If a task becomes cross-disciplinary, name the leading role, adjacent roles, and why they are needed.
- If ownership changes, state the switch before using the new role's rules.

## Production-Ready By Default
- Do not frame work as a PoC, MVP, prototype, temporary shortcut, or placeholder unless the user explicitly asks.
- Small steps are acceptable, but each step must fit the final architecture and remain safe to evolve.
- If an asset or implementation detail is temporary, the contract and behavior must still be replaceable without rewriting the feature.

## Scene-Fidelity Invariant
- Never alter the player entity, shared camera contract, or entity scale to fit a scene to a reference.
- Scene composition uses a dedicated DEV-only authoring camera; only after that visual gate passes may the unchanged player be mounted into the scene.
- Final placement is explicit authored world coordinates and source-locked dimensions, verified in rendered game-window frames both before and after player mount.
- Never multiply scene coordinates or transforms to resize/spread a composition. Structures are local-coordinate prefabs moved manually as one unit.
- Every scene entity/prefab/character/building root scale is always `[1, 1, 1]`; dimensions belong to prefab geometry.
- Visual object acceptance is valid only after rendered front/side/back inspection in a DEV-only isolated scene (a lab, `npm run play -- --lab <id>`, windowed). A full-level frame never substitutes for this gate.
- Here: Unreal units are centimetres and Z is up; the shared lab stage (`dev/src/scenes/lab-stage`) owns sun, sky, ground and camera for every lab.

## Runtime Checks
- The web kit used Playwright for browser/runtime verification instead of HTTP-only checks. Here the three instruments are:
  - game state as numbers: `node tools/game.mjs "<expr>"` (from `dev/`) against every connected game process;
  - the HTML UI: `node tools/ui.mjs text | click <css> | select <css> <v> | eval <js> | console` over CDP; for a game's HUD the game must run with `-cefdebug=<port>`, which `npm run play` passes (the kit's HUD port, 9222 in the main kit) for a windowed process; the dev shell's page (`npm run shell`) answers on the kit's shell port (9221 in the main kit, `VGE_CDP=http://127.0.0.1:9221`);
  - the look: a capture of the rendered game window (AGENTS.md rule 1).
- Before starting a new dev server, check whether one is already running: one `npm run dev` serves any number of game processes, and `node tools/game.mjs "1"` prints `no Unreal process is connected to the dev server` when no game is attached.
- `npm run play` starts a detached game process and prints its pid and log path. Close the game processes you started after the task that used them, with `npm run stop` (this kit's processes only), never by process name: other agents' games run under the same name.
- The main checkout is the stable kit: no development happens in it. It only receives finished, verified work merged from a profile. Every feature, research build or experiment is done in its own profile.
- Assets from Fab: find them with Fab's own search, `npm run fab -- search "<words>" [--free] [--format unreal-engine|gltf|fbx]`, show the user the chosen listing in the shell's Fab window with `npm run fab -- open <listing link>`, and let the user sign in and press Add to Project / Install Plugin there (never press buy, download or sign in for the user); `npm run fab -- installs` then says where it landed: a pack loads by path from `/Game/<Pack>/...` (`onPack`), a model file is imported by its path, a plugin rebuilt the runtime (README, "Fab: assets into the project").
- Work that changes C++ or needs its own build and tests while others keep using the main kit goes into a profile: `npm run profile -- create <name>` gives a checkout on `profile/<name>` with its own ports and runtime (README, "Profiles"). Run every command from that profile's `dev/`; the ports and the dev server are its own. It goes into the main kit by merging the branch and `npm run build:cpp` there.

## Validation
- Before final delivery after code changes, run the repository's standard validation commands when feasible (from `dev/`):
  - `npm run typecheck`
  - `npm run build:cpp` — when C++ under `Source/` changed (it also regenerates `Typing/ue`)
  - `npm run test:agent-tools` — when `.claude/hooks` or `scripts/lib` changed
- `npm run build` exists and is the release build (`dev/tools/build.mjs`: a Shipping game in `Build/Release` with only the imported models; it needs this kit's dev server stopped), run when the task concerns the release. The kit defines no lint, game test or knip script yet (`dev/package.json`); the web kit's `npm run lint`, `npm run test` and `npm run knip` join this list when the kit adds them.
- If validation is blocked or red, report the exact blocker.
- Do not call a task complete while known failures from the current work remain unresolved.

## Repository Rules
- Runtime assets must live near their owning feature/component or shared primitive.
  - Here: 3D source assets (`.glb`, `.gltf`, `.fbx`) are modules. A model reaches the game only when game code imports it (`import flightCase from '../assets/flight-case.glb'`, `dev/vite/contentAssetsPlugin.mjs`); nothing is picked up from a folder, and the release build (`npm run build`) contains only imported models. The import's default export is the handle that `useContentMesh` / `onAsset` / `onMesh` (`dev/src/shared/engine/content.ts`) take.
  - UI images stay beside the `dev/ui` component that imports them.
- Do not import production assets directly from a root `assets/` staging folder. Here: never load cooked content by a hard-coded path into `Plugins/VgeLive`; subscribe with the model import's handle.
- Keep external references, experiments, and throwaway examples out of committed production paths.
- Use CSS Modules for new component UI unless the project has a stronger local convention. Here: the shell page and the UI kit (`dev/ui/features`, `dev/ui/app`, `dev/ui/shell`) use CSS Modules; the HUD page (`dev/ui/hud.tsx`) has one global `styles.css`.
- Prefer isolated features with clear public boundaries for non-trivial product behavior.

## Memory Policy
- Repository-level agent memory lives in [memory.md](./memory.md).
- Role-specific memory lives in `agents/<role>/memory.md`.
- Memory stores durable decisions, constraints, user preferences, source-of-truth changes, and cross-role conflicts.
- Do not duplicate canonical rules from `AGENTS.md` into memory.

## Geometry Invariant
- Final scene assets never ship as bare primitives. Use intentional faceted or
  compound silhouettes with readable cuts and notches.
