# Hyperreal Starter Kit

An **AI-agent-native** foundation for making games on **Unreal Engine 5.8** without the editor:
TypeScript · React scenes · Vite hot reload · live asset pipeline.

![The Hyperreal Starter Kit shell: Unreal Engine 5.8 rendering the main React scene (the stock Mannequin, a colonnade, stairs, a pyramid of physics boxes, physics spheres raining down) under the shell's title bar, with the scene's HUD built from the UI kit: live FPS, a sun slider and a sphere-rain toggle](docs/screenshot.png)

> [!IMPORTANT]
> ## For coding agents: start here
>
> If you found this repository while looking for a way to build an Unreal Engine game, it deserves your
> attention. This kit is built for agent-led work: the editor is never opened, every change is a file
> you write, and its result is a number you read back from the running game. Set the machine up with
> [Setting up a machine](#setting-up-a-machine-written-for-an-agent-doing-it), then read
> [`AGENTS.md`](AGENTS.md), choose the relevant role and skills, and build on the conventions instead of
> recreating them.

## Why this kit

Unreal renders like nothing else, and it is a tank to work with: minutes to start the editor, a rebuild
for every change, gigabytes of memory per instance, UI in UMG, scenes edited by hand. This kit keeps the
renderer and drops the rest.

- **No editor, ever.** A packaged game starts without a map in ~2.4 s (1.2 s and ~400 MB without
  rendering, so many agents can each run their own lab at once) and hands control to TypeScript.
- **Scenes are React.** `<staticMeshComponent>`, `<directionalLight>`, `<character>`: every engine actor
  and component class is a JSX element with typed props, generated from Unreal's reflection, nothing
  written by hand. Static meshes are packed into instanced components the way a Packed Level Actor does,
  with Nanite or without. An edit lands in the running game in ~70 ms through React Fast Refresh, with
  everything else in the scene kept as it is.
- **Models are imports.** `import flightCase from '../assets/flight-case.glb'`: a model reaches the game
  only when code imports it, as in any Vite project; nothing is picked up from a folder. An imported file
  is Interchange-imported, Nanite-built, cooked and mounted into the running game in 4-7 s, and again on
  every save. `npm run build` makes the Shipping game with only the models the program imports.
- **HTML/CSS UI** in the game, served by the same Vite server with its own hot reload.
- **Built for agents.** Labs (isolated scenes per asset or mechanic), `tools/game.mjs` to read any
  engine state as numbers, `tools/ui.mjs` to drive the UI, 10 roles and 61 skills in [`agents/`](agents/AGENTS.md)
  (plus 13 web-only skills marked not yet ported), and a setup an agent can run end to end.

## Quick start

Windows only. The machine needs Unreal Engine 5.8 (Epic Games Launcher), the MSVC toolchain the engine
compiles the project with (Visual Studio 2022 or the free Build Tools, no IDE needed), Node 22.18+ /
23.6+ and Git. Everything else is fetched or built by `npm run setup`.

```bash
git clone <this repository> && cd <repository>/dev
npm install
npm run setup
npm run dev
```

```bash
npm run shell
```

### Setting up a machine (written for an agent doing it)

All commands run from `dev/`. Each prints what it did and exits non-zero on failure.

1. `npm run doctor` - checks every requirement without changing anything and prints `ok` or `MISS` per
   item, each `MISS` with the command that fixes it (`npm run doctor -- --json` for the same as JSON).
   Items: `node`, `engine` (looked up in `VGE_ENGINE`, `vge.config.json`, the Epic Games Launcher install
   list, the registry), `msvc` (Visual Studio's own locator, vswhere), `windows-sdk` (the engine's own
   check, `RunUAT Turnkey -command=VerifySdk`), `runtime` (this kit is linked to a built shared runtime),
   `runtime-sources` (that runtime was built from these C++ sources), `links`.
2. `engine` missing: Unreal Engine 5.8 has to be installed from the Epic Games Launcher (a person signs
   in; it cannot be scripted), or `VGE_ENGINE` set to an existing engine folder.
3. `msvc` or `windows-sdk` missing: `npm run setup -- --install-toolchain` installs Visual Studio 2022
   Build Tools through winget with exactly the components the engine lists in
   `Engine/Config/Windows/Windows_SDK.json` (MSVC 14.44 x64 + ATL, Windows SDK 22621). Windows asks for
   administrator rights once; a person has to accept that prompt.[^toolchain]
4. `npm run setup` - links the kit to the shared runtime (below), building the runtime first when no kit
   on this machine has built it for these C++ sources: downloads the V8 binaries Puerts links against
   (~370 MB, once per machine), copies the engine's template Mannequin, builds the C++ targets, generates
   the typings, makes the project copies of the engine's glTF master materials, packages the base game
   and builds the shell. `-- --rebuild` builds the runtime again.
5. Done when `npm run doctor` shows every item `ok`. Then `npm run dev` (keep it running; the first game
   that opens a scene importing a model builds it, the log shows
   `[content] src/features/demo/assets/flight-case.glb -> VgeLive-bNNNN`), and `npm run shell` (the app with
   the main scene, the labs and the UI kit) or `npm run play -- --scene labs/playground` (one game window);
   `node tools/game.mjs "1"` answers from the running game.

## A scene

```tsx
// a scene module, shortened from dev/src/features/character/labs/playground/index.tsx
import * as UE from 'ue';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { Stairs } from '../../../world';
import { Player } from '../../entities/Player';

export function Scene() {
  return (
    <>
      <LabStage groundSize={30} camera={null} />
      <Player at={[-200, 0, 100]} />
      <Stairs at={[-150, 350, 0]} steps={12} />
      <staticMeshComponent location={[300, 0, 30]} staticMesh="/Engine/BasicShapes/Cube.Cube" mobility={UE.EComponentMobility.Movable} simulatePhysics />
    </>
  );
}
```

Element names are engine class names in camelCase, props are the properties Unreal exposes for editing,
and `npm run typecheck` checks them against the engine's own reflection. Save the file and the running
game updates in place.

## What's inside

- **Main scene** (`npm run shell` or `npm run play`): the stock Mannequin as the player (WASD, Space), a
  colonnade of packed instances, stairs to climb, a pyramid of physics boxes, turning cubes, and
  `features/demo/assets/flight-case.glb` on a turntable that changes in place when the file is saved. Its HUD
  (`dev/ui/hud/MainSceneHud.tsx`, UI kit components) shows the game's FPS and drives the scene: a sun slider
  and a sphere-rain toggle, messages both ways through `bridge.ts` and `useHudMessages`.
- **Labs**, each opened from the shell's lab index (`npm run shell`, Labs) or in its own game window
  (`npm run play -- --lab <id>`):
  `physics` (dominoes pushed once, a box pyramid, spheres added and removed as a list), `instancing`
  (1600 elements packed into one instanced component per material), `lumen` (a closed room lit by the sun
  through a ceiling hole and a glowing panel: bounce light, colour bleeding, reflections), `nanite` (10,000
  copies of the Nanite mesh imported from `flight-case.glb`), `mannequin` (the template's clips played by
  name from TypeScript), `playground`, `spinning-cubes`, `flight-case` (the live asset pipeline).
- **UI kit** - the [web-starter-kit](https://github.com/vibegameengine/web-starter-kit)'s app and UI kit,
  file for file: the shell's lab index and gallery (`/labs`, `/ui-kit`) are its screens, and a game's HUD
  (`dev/ui/hud.html`) is built from its components.

## How it works

The game is Unreal's: a packaged Game target, cooked content, Lumen, Nanite, virtual shadow maps, Chaos
physics. What changes is where it gets its instructions.

```
 dev/src/*.ts ──▶ Vite (environment "unreal": transforms, module graph, HMR)
 import x from '*.glb' ──▶ content pipeline: decode ─ import (content service) ─ DLC cook (standby cooker) ─ UnrealPak ──▶ VgeLive-bNNNN.pak/.utoc
                    │  WebSocket ws://127.0.0.1:5173/__unreal  (modules, HMR, vge:content events)
                    ▼
 VibeGameEngine.exe (Game target) ─ UVgeGameInstance: code-built world, no .umap, MountContent()
                    └─ Puerts JsEnv ─ Content/JavaScript/vge/bootstrap.js (Vite ModuleRunner)
```

## Layout

- `Source/VibeGameEngine` - `UVgeGameInstance` runs the gameplay half of `UEngine::LoadMap` on the world
  that `UGameInstance::InitializeStandalone` already created, then starts the script bootstrap.
  `MountContent` mounts a cooked container and opens its plugin's shader library.
  `AVgeGameMode` spawns a controller and no pawn.
- `Source/VibeGameEngineTools` - editor module used only inside `UnrealEditor-Cmd`:
  `VgeGenTypings` writes `Typing/ue` (TypeScript declarations of every reflected type),
  `VgeContentService` is the resident service the dev server owns (import with Nanite, import of
  animations onto an existing skeleton, delete; JSON lines over stdio), `VgeCook` is a stock cook that starts early and waits in standby
  (`-RunAsCookCommandlet`), `VgeImport` is the same import as a one-shot command.
- `Plugins/Puerts` - Puerts from master (commit c5cd096, 2026-10-22). Local changes:
  `JsEnv.Build.cs` selects V8 11.8.172 and enables the built-in WebSocket without TLS;
  `Content/JavaScript/puerts/websocketpp.js` logs the reason a connection fails.
  V8 binaries are not in git: `npm run setup` downloads `v8_bin_11.8.172.tar.gz` from
  https://github.com/puerts/backend-v8/releases/tag/V8_11.8.172__251225 once per machine into
  `%USERPROFILE%\.vge\V8\v8_11.8.172`, which each runtime links as
  `Plugins/Puerts/ThirdParty/v8_11.8.172`.
- `Plugins/VgeLive` - content-only plugin that live content is cooked into as DLC against the base
  release (`Releases/dev`).
- `dev/server.mjs` - Vite dev backend; one server for any number of Unreal processes.
- `dev/content/` - the content pipeline. `service.mjs` owns the resident content service the way Vite
  owns esbuild (started with the dev server, restarted if it dies; it exits by itself when its stdin
  closes), `cooker.mjs` keeps one warmed-up cook process in standby, `pipeline.mjs` runs a build: the
  cook and packaging are the stock DLC steps BuildCookRun runs; each build gets its own container.
  `decode.mjs` is the glTF rewrite both the pipeline and the release build use.
- `dev/vite/contentAssetsPlugin.mjs` - model files (`.glb`, `.gltf`, `.fbx`) as modules: the default export
  is the asset's handle, keyed by the file's path (`src/features/demo/assets/flight-case.glb`); a model lives beside the
  feature that owns it. The dev server builds a file
  when the game code first imports it and on every save; a file nothing imports is never built.
- `dev/runner/` - the in-engine side: Web API polyfills, Vite `ModuleRunner` with a reconnecting
  WebSocket transport, and an evaluator that maps `ue` / `puerts` to Puerts' native modules.
  `npm run bundle-runner` writes `Content/JavaScript/vge/bootstrap.js`.
- `dev/src/` - the game code in TypeScript, laid out like the web starter kit (FSD):
  - `app/program.ts` - the program: UI host, then the scene named by `-Scene=` (default `main`).
    `main.ts` is the dev entry (React Fast Refresh, debug seam, program); `release.ts` the release entry.
  - `shared/engine/world.ts` - ownership scopes: everything spawned or hooked up (`spawn`, `every`,
    `everyFrame`, `own`) belongs to the open `scene` or to the `app`; opening a scene clears the scene
    scope, a full reload clears both. `content.ts` mounts new content builds and calls `onAsset` /
    `onMesh` subscribers (given an imported file's handle) with every new version.
  - `shared/react/` - the scene renderer: React elements named after engine classes in camelCase
    (`<staticMeshActor>`, `<pointLightComponent>`, `<character>`) become actors and components. Their props
    and types are generated from reflection by `VgeGenTypings` (`Typing/ue/ue-jsx.d.ts`, `ue-jsx.json`):
    EditAnywhere / BlueprintReadWrite properties, Blueprint `Set<X>` setters without a property, events as
    `on<X>`. A prop is written through the property's `Set<Name>` function when there is one, the rule
    Sequencer uses (FTrackInstancePropertyBindings). A `staticMeshComponent` with no physics, events or ref
    is packed the way a Packed Level Actor packs it: one instanced component per `FISMComponentDescriptor`
    (`UVgeInstancePool`, always an ISM: HISM does not render instances added by stable id), one instance
    per element. A scene module
    that exports `Scene` (a React component) is rendered; edits apply with React Fast Refresh.
  - `shared/lib/devLab.ts` - the lab contract: `features/<slice>/ui/<id>.lab.ts` exports only its
    manifest, the body lives in `features/<slice>/labs/<id>/`; `app/scenes.ts` finds labs by glob.
  - `scenes/main` - the main scene; `scenes/lab-stage` - the shared stage labs mount (sun, sky,
    collidable ground, camera).
  - `features/demo`, `features/character` (the stock Mannequin, modular skeletal characters from content,
    a player character whose clips are chosen in TS from its movement state), `features/world` (stairs).
  - `app/ui-host.ts` - game side of the HUD page; `app/debug-seam.ts` - expression evaluation for agents.
- `dev/ui/` - the HTML/CSS UI (React), served by the same Vite server with its normal browser HMR, as two
  pages. `index.html` is the shell's app: the web-starter-kit's router, lab index and UI kit, with
  `features/world` (a scene as a `<GameWorld>`) and `shell/` (the window's title bar) of this kit's own.
  `hud.html` is a game's HUD, shown by the engine's embedded browser (CEF) as a transparent overlay on the
  game: `bridge.ts` talks to the game (`window.ue.vge`); elements with `data-hit` take the mouse, the rest
  of the screen stays the game's.
- `shell/src/` - the dev shell (C++, CEF from the engine): the frameless window, the page, and the worlds.
- `dev/tools/` - agent and measurement tools (below).

## Agent tools

| Command | What it does |
|---|---|
| `node tools/game.mjs "<expr>"` | evaluates an expression in every connected game process (`UE`, `puerts`, `world`, `gameInstance` in scope) and prints the results: read state as numbers |
| `node tools/ui.mjs text \| click <css> \| select <css> <v> \| eval <js> \| console` | drives the HTML UI over CDP: a game's HUD (`npm run play` opens it on 9222), or the shell's page with `VGE_CDP=http://127.0.0.1:9221` |
| `npm run labs:previews [<id>...]` | captures each lab's preview for the shell's lab index: a rendered 1600×900 game window per lab, `HighResShot`, written as `dev/ui/app/ui/labs/previews/<id>.webp` |
| `npm run build:cpp` | after a C++ change: builds the shared runtime for the new sources (C++ targets, typings, base game, shell) and links the kit to it |
| `npm run profile -- create <name> \| list \| remove <name>` | a profile: a second checkout on its own branch with its own ports and runtime link, to build and test a feature beside the main kit (below) |
| `npm run stop [-- game\|dev\|shell]` | stops this kit's own processes, and only those |
| `npm run typecheck` | `tsc` over game and UI code against the generated typings |
| `VibeGameEngine.exe -Scene=labs/<id> [-nullrhi]` | an isolated process for one lab, sharing the dev server and content service |

## Run

```bash
cd dev && npm run dev
```

```bash
cd dev && npm run play
```

```bash
cd dev && npm run shell
```

`npm run shell` opens the Hyperreal Starter Kit shell (`shell/src`, C++): a borderless window with CEF, the
engine's own build (`Engine/Source/ThirdParty/CEF3`), compiled with the machine's MSVC into the shared
runtime's `Build/Shell/HyperrealStarterKit.exe`. It loads the kit's app from the dev server - the
web-starter-kit's router, lab index and UI-kit gallery, file for file (`dev/ui`). A scene in that app is a
`<GameWorld scene="...">` (`dev/ui/features/world`): the shell starts the game for it as its own process (its
own world, V8 and HUD), borderless (`bUseBorderlessWindow`), and keeps that window under the element; the page
is transparent there and draws its own UI over it. `/` is the main scene, `/labs` the lab index, `/labs/<id>` a
lab's world, `/ui-kit` the gallery; leaving a scene's route ends its process. Over a world the shell page puts the
scene's controls (back to the labs, the UI kit), and a backdrop while the world starts or after it has closed.
The window has its own title bar (`dev/ui/shell`: drag, double-click to maximize, minimize / maximize / close)
and resizes from its edges; the worlds follow. The release build has no shell.

`npm run dev` starts the Vite server, the content service and the standby cooker. `npm run play`
starts a game window on the main scene (`-- --scene labs/<id>` for another scene, `-- --lab <id>
--headless` for an agent's isolated lab process without rendering). Game options when started by hand:
`-Scene=<id>`, `-DevServer=ws://host:port/__unreal`, `-Entry=/src/main.ts`, `-nullrhi`,
`-cefdebug=<port>`. The game reconnects by itself when the dev server restarts.

The dev server is the web-starter-kit's lean variant, always: no sourcemaps and compressed responses, with
per-module HMR unchanged. The game's modules come without the inline sourcemap Vite would add
(`remoteRunner.inlineSourceMap: false` on the `unreal` environment), the pages' modules through the web kit's
`dev/vite/devLeanTransportPlugin.ts` (sourcemaps stripped, brotli/gzip). Measured cold, with the measuring
scripts of both kits: the game's entry graph 5.1 MB → 1.63 MB (55 modules, 3.46 MB of it sourcemaps), the shell
page 5.38 MB → 0.32 MB on the wire (69 requests). Stack traces point into the transformed modules, not the
sources.

Typings and type checking:

```bash
cd dev && npm run typings && npm run typecheck
```

## Build and package (headless, no editor UI)

The compiled side - the game, the editor modules the content service and the cooker load, the base
package, the shell - is the same for every kit built from the same C++ sources: it only shows what the kit
gives it (the TypeScript from the dev server, the content it cooks). So it is built once per machine into a
shared runtime, `%USERPROFILE%\.vge\Runtime\<key>`, where `<key>` hashes the engine build, the
V8 version and every file under `Source/`, `Plugins/`, `Config/`, `Content/`, `shell/src` and the
`.uproject` (`dev/tools/runtime.mjs`). A kit compiles nothing: `npm run play`, the shell and the release
build start the runtime's executables by their path, and the engine-side folders Unreal itself looks up
inside the project - `Binaries`, `Plugins/Puerts/Binaries`, `Releases`, `Content/Vge/Materials`,
`Content/Characters/Mannequins` - and `Typing` are junctions into the runtime. A second kit on the machine
links to the runtime the first one built; a kit whose C++ differs gets its own.

`npm run setup` builds it on first start; afterwards `npm run build:cpp` builds the runtime for changed
C++ sources and links the kit to it, and `npm run setup -- --rebuild` builds the current runtime again. A new
runtime builds in its own folder of the store, so dev servers keep running on theirs meanwhile; only rebuilding a
runtime that a running dev server holds is refused (its content service keeps that runtime's editor DLLs open,
`~/.vge/in-use`), and a kit's dev server is restarted after the kit is linked to another runtime. The
steps (`dev/tools/steps.mjs`) are the engine's own, run on a copy of the sources inside the runtime:
`Build.bat` for the `VibeGameEngineEditor` target and the `VibeGameEngine` target (Development and
Shipping), `-run=VgeGenTypings`, `RunUAT BuildCookRun -cook -stage -pak -iostore -archive
-createreleaseversion=dev` into `Build/Package`, and the shell. Unreal's stock Mannequin is copied from the
engine's Third Person template resources (`Templates/TemplateResources/High/Characters/Content/Mannequins`,
not in git, 126 MB) to `Content/Characters/Mannequins`, the path the template uses.

### Profiles: building and testing a feature beside the main kit

```bash
cd dev && npm run profile -- create anim-graph
```

A profile is a second checkout of the kit, `../hyperreal-starter-kit.<name>`, a git worktree on the branch
`profile/<name>` made from the last commit, with its own `vge.config.json`: its own ports (the main kit's + 10 per
profile: dev server 5183, HUD DevTools 9232, shell DevTools 9231 for the first) and its own link to the runtime for
its sources. Its dependencies are junctions to the main checkout's `node_modules`. Everything in it is the kit's
usual commands run from its own `dev/`: `npm run dev`, `npm run play`, `npm run build:cpp`, `node tools/game.mjs`,
`node tools/ui.mjs`. Its games connect to its own dev server (`-DevServer=`, also for the shell's worlds), and each
kit lists the processes it started (`Saved/processes.json`), so `npm run stop` in a profile ends only that
profile's dev server, games and shell. A profile whose C++ sources match a built runtime links to it at once; one
with changed C++ builds its own beside the others, while the main kit and other profiles keep running.

When the feature is done and checked, it goes into the main kit by merging `profile/<name>` there and running
`npm run build:cpp`: when nothing else changed in the main kit meanwhile, the merged sources are the profile's and
their runtime is already built, so the kit is only relinked; otherwise the merged runtime builds beside the running
one. `npm run profile -- remove <name>` stops the profile's processes and removes its checkout (its links are
removed as links first); the branch stays. `npm run profile -- list` shows every checkout with its ports, runtime
and what runs in it.

### Release build

```bash
cd dev && npm run build
```

Makes the Shipping game in `Build/Release/Windows` (this kit's dev server must be stopped). What goes in is what
the program imports: Vite bundles `src/release.ts` into `Content/JavaScript/vge/game.js` and the UI into
`Content/UI`; every model file the bundle imports is imported into `/Game/Vge/Imported/<folder>/<Name>` and
its object paths are written into the bundle. `BuildCookRun -clientconfig=Shipping` then cooks the base
content plus `/Game/Vge/Imported`, and the build removes those inputs from the project again. A Shipping
game runs `game.js` instead of the dev bootstrap and opens the UI from its own files.

The editor target is built only for `UnrealEditor-Cmd` (cooker, typings, import).
`-createreleaseversion=dev` writes the base release the content pipeline cooks DLC against; repackage
the base when engine-side content or code changes. JavaScript is staged as loose files, so a new
`bootstrap.js` can be copied into the package without repackaging; game code comes from Vite.

## Engine notes

- The world we play in is the placeholder `UGameInstance::InitializeStandalone` creates;
  `UWorld::CreateWorld` gives it `ShouldSimulatePhysics(false)` and no navigation (World.cpp), which
  `UVgeGameInstance` turns on as a world loaded by `LoadMap` would have them.
- `ACameraActor` constrains its view to 16:9 by default (CameraActor.cpp); scenes turn it off.
- Script gameplay runs in `everyFrame` (`UVgeGameInstance.OnTick`): engine systems such as
  `CharacterMovement` consume input every frame, and a wall-clock timer skips frames.
- Interchange makes imported materials instances of its glTF masters (`/InterchangeAssets/gltf`),
  cooked into the base without skeletal or Nanite usage; `-run=VgeMaterials` creates project copies
  with those usages and the importer reparents instances onto them.
- A glTF character with several mesh nodes imports as several skeletal meshes on one skeleton; the
  runtime assembles them with `SetLeaderPoseComponent`.
- React Fast Refresh runs in the engine's V8: @vitejs/plugin-react enables it for the browser only and
  Vite's oxc plugin turns JSX refresh off for `server` consumers, so `dev/server.mjs` applies the same oxc
  transform and the same refresh wrapper (`vite/internal`) to the `unreal` environment; the preamble is
  `src/app/refresh.ts`, `window` is aliased in `runner/polyfills.ts`. React and the reconciler are CommonJS
  and go through the dependency optimizer with platform `neutral` (the `node` default imports `node:module`).
- Children without `key` are matched by position, as in any React tree: an element inserted before a
  sibling remounts that sibling (its actors are respawned). Give stateful subtrees a `key`.
- Characters animate without an Animation Blueprint: TS picks the clip every frame and plays it with
  `PlayAnimation` (single-node instance). The player character uses the stock Mannequin (`SKM_Manny_Simple`)
  and the template's unarmed set: `MM_Idle`, `MF_Unarmed_Jog_Fwd`, `MM_Jump`, `MM_Fall_Loop`, `MM_Land`.

## Content pipeline notes

- Interchange in 5.8 cannot read `EXT_meshopt_compression`, `KHR_draco_mesh_compression`,
  `KHR_mesh_quantization`, `EXT_texture_webp`; the decode step rewrites such files as plain glTF/PNG.
- Stock cook-on-the-fly cannot serve packages created after its session started
  (`IoStoreCookOnTheFlyRequestManager` fills its package registry once), so new content goes into a
  new container mounted with `MountContent`, the engine's DLC/patch mechanism, which also works in Shipping.
- The decode step drops `:` from node names (`mixamorig:Hips` and `mixamorigHips` are the same bone).
- The cook runs with `-SkipZenStore` so the cooked files are on disk for UnrealPak, which then takes
  `-PackageStoreManifest` and `-ScriptObjects` as in UAT's non-Zen staging.

## Measured (2026-10-23, this machine)

| | Result |
|---|---|
| Game with rendering (DX12, Lumen, VSM): time to scene built | 2.3-2.5 s, 1.6 GB working set, 3.8 GB private |
| Game `-nullrhi` | 1.1-1.2 s, 370 MB working set, 270 MB private |
| 4 x game `-nullrhi` at once, one Vite server | 1.2-1.4 s each, 370 MB each |
| React Fast Refresh of a lab (`node tools/measure-hmr.mjs`: file write to "hot updated" in the game log) | median 67 ms, max 70 ms over 8 runs |
| Edit of `main.ts` (full reload) | scene rebuilt, actor count unchanged (23) over 4 reloads |
| Typings generation (`npm run typings`) | 42 s, `ue.d.ts` 14.6 MB |
| Content build of one .glb (decode, import + Nanite, DLC cook, pak, IoStore) | 4.0-6.3 s: import 1.1-2.7 s, cook 1.8-2.9 s, pak + IoStore ~1 s |
| Save of a .glb to the new mesh in the running game | 4.0-4.6 s (27 s with a fresh process per step) |
| Release build (`npm run build`: bundle, import of the imported models, Shipping build, cook, stage) | 1.0-1.4 min with the Shipping target already compiled once |
| Dev kit memory: content service + standby cooker + Vite | 2.1 GB + 1.7 GB + 0.1 GB working set, once per machine |
| Scene switch inside one game (`openScene`) | 31-180 ms |
| Lab in its own `-nullrhi` process | opened in 31 ms, 410 MB working set |
| Player character speed check (W held 1.5 s) | 436 cm moved; stairs climbed to Z 330 (expected 328) |
| React playground: edit adding a flight of stairs | applied by Fast Refresh, no program reload; 8 instances added to the existing group |
| React playground: edit of a prop in place (8 -> 10 steps) | applied without a program reload; other actors and the player kept |
| React playground across two full reloads | 2 instanced groups, 13 instances, 30 actors each time (nothing leaks) |
| Mannequin player clips, sampled while playing | moving: `MF_Unarmed_Jog_Fwd`, standing: `MM_Idle`, Space: `MM_Jump` then `MM_Fall_Loop` |

Frame rate, `npm run fps` over 5 s of every frame: Epic quality, 1920x1080 windowed, DX12, Lumen, virtual
shadow maps, vsync off, RTX 4080 SUPER.

| Scene | Average fps | 1% low fps | Frame time |
|---|---|---|---|
| main | 162.1 | 109.8 | 6.17 ms |
| `lumen` | 204.8 | 135.9 | 4.88 ms |
| `physics` (61 bodies simulating) | 205.8 | 132.9 | 4.86 ms |
| `instancing` (1601 instances, 5 components) | 215.6 | 140.5 | 4.64 ms |
| `nanite` (10,001 instances, 2 components) | 189.9 | 127.6 | 5.26 ms |

For comparison, the full editor on an empty project: 17 s warm / 65 s cold start, 3.3 GB working set.
The cook runs in a separate process per build because in-editor cook is deprecated since 5.7
(UnrealEdEngine.cpp); the standby process takes its ~6.5 s engine start off the path of an edit.
A save that lands while the next standby is still starting waits for it (up to ~8.5 s).
Rebuilding the VibeGameEngineTools module needs the dev server stopped: the service holds its DLL.

## License

The kit's own code is [MIT](LICENSE). Unreal Engine is not part of this repository: every user installs it
from the Epic Games Launcher and builds the project against it, under Epic's
[Unreal Engine EULA](https://www.unrealengine.com/eula/unreal). Hyperreal Starter Kit uses Unreal® Engine;
Unreal® is a trademark or registered trademark of Epic Games, Inc. This project is not affiliated with
Epic Games. Third-party notices: [NOTICE.md](NOTICE.md).

[^toolchain]: Not verified yet: `npm run setup -- --install-toolchain` has not been run on a machine
    without the toolchain. An agent that hits a problem there: fix it in `dev/tools/prereqs.mjs` /
    `dev/tools/setup.mjs`, confirm with `npm run doctor`, and open a pull request with the fix and what failed.
