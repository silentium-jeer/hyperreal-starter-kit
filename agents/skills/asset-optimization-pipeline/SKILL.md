---
name: asset-optimization-pipeline
description: >-
  How source assets become live, cooked, compressed content in this Unreal kit
  and how to extend it. A .glb/.gltf/.fbx lives beside the feature that owns it
  and reaches the game only when game code imports it; the dev server then
  decodes it, imports it with Nanite in the resident content service, DLC-cooks
  it in the standby cooker, packages it with UnrealPak (.pak + IoStore, Oodle)
  and mounts it into every running game, which receives it through the import's
  handle with onAsset/onMesh/useContentMesh. Enforces: optimizations stay on (fix
  the consumer), assets are addressed by their import handle never by cooked
  path, new asset types are added to the plugin AND the runtime type. MANDATORY
  before: adding or replacing a model file, adding an asset TYPE, touching
  vge/content/*.mjs, vge/vite/contentAssetsPlugin.mjs or
  src/shared/engine/content.ts, changing decode/cook/pak compression, or
  debugging "my asset does not show up". Trigger on: "add a model", "GLB
  import", "glTF", "content pipeline", "cook", "pak", "IoStore", "MountContent",
  "onAsset", "onMesh", "Interchange", "Nanite", "meshopt", "draco", "quantize",
  "WebP texture", "asset not updating", "content build failed".
---

# Asset optimization pipeline

Assets in this kit are **processed by the dev server's content pipeline while the
game runs**, not by hand and not by the editor (which is never opened). The
pipeline lives in `vge/content/` and is owned by `vge/server.mjs`
(`contentPlugins()`). A model file is a module of the game code, the way Vite
treats every asset: it lives beside the feature that owns it
(`src/features/demo/assets/flight-case.glb`) and is built only when code
imports it (`import flightCase from '../assets/flight-case.glb'`). Nothing is
picked up from a folder.

| Step | Where | What it does |
|---|---|---|
| import | `vge/vite/contentAssetsPlugin.mjs`, `vge/server.mjs` `contentPlugins()` | When the game code first loads a model file, the plugin queues a build if the file has no build yet or changed since its last one (`pipeline.isStale`); every later save of an imported file queues one (`hotUpdate` → `pipeline.enqueue`). The module's default export is the handle `{ key }`, `key` being the file's path relative to the kit root (`src/features/demo/assets/flight-case.glb`). |
| decode | `vge/content/decode.mjs` `createDecoder()` | gltf-transform rewrites what Interchange 5.8 cannot read — `EXT_meshopt_compression`, `KHR_draco_mesh_compression`, `KHR_mesh_quantization` (dequantize), `EXT_texture_webp` / `EXT_texture_avif` (re-encoded as PNG) — as plain glTF. Files without those extensions pass through untouched. |
| import | `vge/content/service.mjs` (resident `VgeContentService`) | Interchange import with Nanite on, saved into the `VgeLive` plugin under a per-version path `/VgeLive/<Name>_bNNNN`; the previous version is deleted. |
| cook | `vge/content/cooker.mjs` (standby `CookCommandlet`) | Stock DLC cook (`-dlcname=VgeLive -basedonreleaseversion=dev -SkipZenStore`) in a process started ahead of time. |
| package | `pipeline.mjs` | `UnrealPak -CreateMultiple` (.pak) and `-CreateDLCContainer` (.utoc/.ucas), Oodle Kraken level 4, one new container per build: `VgeLive-bNNNN`. |
| mount | `src/shared/engine/content.ts` | The game receives the manifest (`vge:content`, assets keyed by the import key), calls `gameInstance.MountContent(pak, plugin)`, and calls every `onAsset(handle)` subscriber whose asset changed. |

The release build (`npm run build`, `vge/tools/build.mjs`) runs the same plugin
over `src/release.ts`: each model the bundle imports is imported by the content
service into `/Game/Vge/Imported/...`, its objects' paths are baked into the
handle (`objects`), and only those models are cooked into the Shipping game in
`Build/Release`. A model nothing imports is not in the game.

The cook and packaging are the stock DLC steps BuildCookRun runs. Each build gets
its own container because stock cook-on-the-fly cannot serve packages created
after its session started (README, "Content pipeline notes").

Measured (README, 2026-10-23, this machine): one `.glb` builds in 4.0–6.3 s
(import 1.1–2.7 s, cook 1.8–2.9 s, pak + IoStore ~1 s); a save reaches the
running game in 4.0–4.6 s; a save that lands while the next standby cook process
is still starting waits for it (up to ~8.5 s).

## Rule: optimizations stay on — fix the consumer (AGENTS.md rule 5)

- A source `.glb` keeps the compression it was authored with (meshopt, Draco,
  quantization, WebP). The decode step is the consumer adapting to it; it is
  never a reason to export an uncompressed source "so Interchange can read it".
- The cook and pak compression flags in `pipeline.mjs` stay as they are. Turning
  one off to make something load is shipping the bytes to hide a bug.
- If a compressed source breaks something after import, the fault is in decode,
  import or the runtime consumer, and it is fixed there. The web kit's worked
  example: meshopt quantization rescaled a skinned mesh's bind pose, and the fix
  went into the consumer that measured it, not into the import. Re-verify
  skinning and animation in a rendered window after any decode change.
- Removing an optimizer is a change the user asks for explicitly.

## Rule: address content by its IMPORT HANDLE, never by cooked path

- An asset is identified by the import's default export, the handle
  `{ key, objects? }` (`ContentAssetRef`, `src/shared/engine/content.ts`).
  The key is the file's path relative to the kit root, so two features may each own a
  file of the same name.
- Game code subscribes with the handle: `onMesh(flightCase, (mesh) => …)` for the
  first static mesh, or `onAsset(handle, (asset) => …)` for `meshes`,
  `skeletalMeshes`, `animations` and `objects` (`{ path, class }`); in React,
  `useContentMesh(handle)` / `useContentAsset(handle)`
  (`src/shared/react/content.ts`). The listener runs as soon as the asset is
  available and, in the dev server, again on every new build; the subscription
  belongs to the open scene. A slice that shares a model re-exports the handle
  (`src/features/demo/index.ts`).
- Never hard-code `/VgeLive/<Name>_bNNNN/...`: the path changes with every build
  and the previous version is deleted. `loadContent(path)` is for paths the
  manifest just handed you, and logs when the mounted builds lack them.

## Adding a new asset TYPE (do all of it)

1. **Plugin:** the accepted extensions are the `MODEL` regex in
   `vge/vite/contentAssetsPlugin.mjs`; the game's module type for them is
   declared in `src/models.d.ts`; and the file must be something the import
   step can translate.
2. **Runtime type:** `manifest()` in `pipeline.mjs` hands over each asset's raw
   `objects`; `describe()` in `src/shared/engine/content.ts` groups them by
   class (`StaticMesh`, `SkeletalMesh`, `AnimSequence`). A new class the runtime
   needs by kind gets its own list there and the same field in the `ContentAsset`
   interface, and a helper like `onMesh` if callers need one.

Changing `vge/content/*.mjs` means restarting `npm run dev` (it is the server's
own code, not a hot-reloaded game module). Rebuilding the `VibeGameEngineTools` module
needs the dev server stopped, because the content service holds its DLL (README).

## Import specifics (from README, "Engine notes")

- Interchange makes imported materials instances of its glTF masters
  (`/InterchangeAssets/gltf`), cooked into the base without skeletal or Nanite
  usage; `-run=VgeMaterials` creates project copies with those usages and the
  importer reparents instances onto them.
- A glTF character with several mesh nodes imports as several skeletal meshes on
  one skeleton; the runtime assembles them with `SetLeaderPoseComponent`
  (`features/character/entities/modularCharacter.ts`).
- Imported glTF characters face local +Y with the pivot at the feet
  (`features/character/entities/Player.tsx` rotates the mesh by −90 yaw and lowers
  it by the capsule half-height).
- Engine-side content and C++ changes need the base package rebuilt
  (`BuildCookRun ... -createreleaseversion=dev`, README "Build and package"); the
  DLC cook is based on that release.

## Gotchas (do not re-discover these)

- **A saved source DOES refresh the running game** — the opposite of the web
  kit, whose optimizer cached by import URL and kept serving stale bytes. Here a
  save is a new build, a new container and a new mount. If the game does not
  update, read the logs below before anything else.
- **One build at a time.** A file saved again while it is building is rebuilt
  once afterwards, not once per save.
- **The game must have been connected to receive a build.** After a reconnect the
  runtime asks for the current manifest again (`vge:content-sync`), so a build
  made while it was cut off still arrives.
- **Only imported files build.** A model no loaded module imports is never
  built; if a file does not show up, first check that the code which imports it
  actually runs.
- **Where a failure is printed:** the dev server console (`[content] building
  <key>`, `[content] <key> -> VgeLive-bNNNN in X s {timings}`, or the error); the
  game log (`[content] build N mounted, assets: …`, `[content] <file>: <message>`
  from `vge:content-error`, `[content] could not mount …`); per build,
  `unreal/Plugins/VgeLive/Saved/Pipeline/bNNNN/` holds `import.json`, `cook.log`,
  `pak.log` and `iostore.log`; the content service writes
  `unreal/Plugins/VgeLive/Saved/content-service.log`.
- `unreal/Plugins/VgeLive/Content/*`, `unreal/Plugins/VgeLive/Saved/` and `Releases/` are
  git-ignored: they are pipeline output, regenerated, never committed.

## Verify a change end-to-end

With `npm run dev` running and a game connected (`npm run play -- --lab <id>`
for a lab that imports the asset):

1. Save the source beside the feature that owns it and import it from that
   feature's code (or save over an already imported file).
2. Read the server line `[content] <key> -> VgeLive-bNNNN in X s` and the game
   line `[content] build N mounted, assets: …`.
3. Read the result as numbers: `node vge/tools/game.mjs "<expr>"` — the mesh on the
   subscribing actor, its bounds, its material, the skeletal mesh count.
4. Look at it in a rendered window, capture, inspect (AGENTS.md rule 1). For a
   skinned or compressed source, confirm the mesh, skinning and animation survived
   decode and import (no exploded vertices, the clip still plays).
