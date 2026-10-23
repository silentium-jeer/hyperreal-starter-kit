# The dev loop

How work moves through this kit, from a cold machine to a verified change. The
reference for every command and number below is the repository
[README.md](../README.md); this page orders them into a working session.

## Once per machine

- Unreal Engine 5.8 from the Epic Games Launcher, Visual Studio 2022 with C++, Node.
- `cd dev && npm install && npm run setup`: finds the engine (`dev/tools/engine.mjs`) and links the kit
  to the shared runtime in `%USERPROFILE%\.vge\Runtime\<key>`, building it first when no kit on the
  machine has built it for these C++ sources: the V8 binaries, the template Mannequin, the C++ targets
  and the typings, the base game packaged with `-createreleaseversion=dev`, and the shell. A second kit
  on the same machine only links. `npm run play` starts the runtime's
  `Build/Package/Windows/VibeGameEngine/Binaries/Win64/VibeGameEngine.exe`, and the content pipeline
  cooks live content as DLC against that release.
- `node scripts/link-agent-skills.ts` from the repository root, so `.claude/skills`
  and `.codex/skills` point at `agents/skills` (directory junctions on Windows; no
  administrator rights needed).

## Every session

1. **One dev server:** `cd dev && npm run dev`. It starts Vite, the resident
   content service and the standby cooker, and serves any number of game
   processes (measured: 2.1 GB + 1.7 GB + 0.1 GB working set, once per machine).
   Reuse it; do not start a second one. Check first:
   `node tools/game.mjs "1"` answers from every connected game.
2. **A game:** `npm run play` — a 1280×720 window on the main scene, with the UI's
   DevTools on port 9222. `-- --scene <id>` opens another scene,
   `-- --lab <id>` a lab, `-- --lab <id> --headless` an isolated `-nullrhi`
   process for numbers only. Each process logs to
   `Saved/Logs/play-<scene>-<time>.log`. The game reconnects by itself when the
   dev server restarts.

## The edit loop

| You change | What happens | Measured (README) |
|---|---|---|
| a scene or component under `dev/src` | React Fast Refresh re-renders it inside every connected game process; the rest of the scene keeps its state | median 67 ms, max 70 ms from file write to the update (`node tools/measure-hmr.mjs`) |
| `dev/src/main.ts`, `dev/src/app/program.ts` | full reload: both ownership scopes cleared, the open scene rebuilt | actor count unchanged over 4 reloads |
| a file under `dev/ui` | normal browser HMR inside CEF | — |
| a model file the game code imports | decode, import with Nanite, DLC cook, pak + IoStore, mounted in every game | 4.0–4.6 s from save to the new mesh in the game |
| the scene inside one game (`openScene`) | the previous scene's scope cleared, the new one built | 31–180 ms |
| the scene, from the shell (`npm run shell`) | the old scene's game process ends, a new one starts on the new scene | ~2.4 s to the scene |
| C++ under `Source/`, `Plugins/`, `shell/src`, engine-side `Config/` or `Content/` | nothing until `npm run build:cpp`: a new shared runtime for these sources (targets, `Typing/ue`, base package, shell), and the kit linked to it | typings alone: 42 s |
| `dev/content/*.mjs` or `dev/server.mjs` | nothing until the dev server is restarted | — |

Rebuilding the `VibeGameEngineTools` module needs the dev server stopped, because the
content service holds its DLL.

## Seeing and measuring

- **Numbers:** `node tools/game.mjs "<expr>"` evaluates in every connected game
  with `UE`, `puerts`, `world` and `gameInstance` in scope. Read the value where
  it first goes wrong before forming a hypothesis (AGENTS.md rule 2b).
- **The UI:** `node tools/ui.mjs text | click <css> | select <css> <v> |
  eval <js> | console` over CDP: a game's HUD on 9222, the shell's page with
  `VGE_CDP=http://127.0.0.1:9221`.
- **The look:** a capture of the rendered game window, opened and inspected. A
  `-nullrhi` process is never visual evidence (AGENTS.md rule 1).
- **Isolation:** behaviour is measured in a lab, integration in a scene
  (AGENTS.md rule 2a; `agents/skills/dev-lab-authoring`).
- **Logs first:** the game log and the dev server console are read before any
  hypothesis about a failure.

## Before delivery

From `dev/`: `npm run typecheck` (run `npm run typings` first if `Typing/ue` is
missing), and `npm run build:cpp` when C++ changed. Then the visual gate in a
rendered window (`agents/skills/visual-verification-gate`). Commit on a branch as
soon as a coherent piece works (AGENTS.md rule 0).

## Packaging

The README's "Build and package" commands build the targets and run
BuildCookRun headless (no editor UI) into the shared runtime's `Build/Package`. JavaScript is staged
as loose files, so a new `Content/JavaScript/vge/bootstrap.js`
(`npm run bundle-runner`) can be copied into the package without repackaging;
game code itself comes from Vite.
