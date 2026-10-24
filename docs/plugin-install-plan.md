# Installing plugins without a full runtime rebuild (plan, not started)

Research of 2026-10-24, reading only. Goal: adding a plugin (for example one from Fab) must not cost a full
rebuild of the shared runtime. [V] = read in the code, [I] = inference.

## Where the time goes today

- [V] `Plugins` is part of the runtime key (`dev/tools/runtime.mjs:12`); the key hashes every file
  (`runtime.mjs:32-37`). Any new plugin file gives a new key and an empty `~/.vge/Runtime/<key>`.
- [V] For a new key `ensureRuntime` (`runtime.mjs:113-136`) does everything from scratch: stages all sources,
  builds three UBT targets (editor Development, game Development and Shipping, `steps.mjs:37-43`), typings,
  master materials (always, the new folder has none, `runtime.mjs:130`), a full BuildCookRun cook + pak + IoStore
  (`steps.mjs:54-70`), and the shell (`steps.mjs:89-119`).
- [V] `pruneBuildLeftovers` (`runtime.mjs:99-111`) deletes `Intermediate`, `Plugins/Puerts/Intermediate` and
  `Saved/Cooked`, so the next key can never build incrementally.
- [I] A Fab plugin with gigabytes of content in `Plugins/` is also hashed on every key computation and copied into
  every new runtime folder.

## The constraint

- [V] The game is monolithic: one `VibeGameEngine-Win64-Shipping.exe`, no module DLLs; the installed engine has no
  modular `UnrealGame-*.dll`. In a monolithic build a plugin's code must be compiled into the exe
  (`PluginManager.cpp:2521-2541`). A C++ module cannot be loaded into a finished game, only relinked.

## By plugin kind

**Content only (`"Modules": []`)**: no runtime rebuild at all.
- [V] The mechanism exists: DLC cook against the base release and pak/IoStore (`dev/content/pipeline.mjs:53-59`,
  `:116-131`), mounted by `MountContent` (`VgeGameInstance.cpp:103-128`); works in Shipping (README:334).
- [V] In the way: the pipeline is fixed to one plugin (`const PLUGIN = 'VgeLive'`, `pipeline.mjs:18`, also in
  `-dlcname` `:56`, `mountPath` `:87`, `-CreateDLCContainer` `:131`); `MountContent` only mounts the pak and calls
  `FindPlugin` (`:121`), so a plugin absent from the base package is unknown to the engine (no `/Name/` mount
  point, no shader library). It has to be registered first with `IPluginManager::AddToPluginsList(.uplugin)` and
  `MountExplicitlyLoadedPlugin` (`IPluginManager.h:299`, `:556`), as GameFeatures does
  (`GameFeaturePluginStateMachine.cpp:2716`, `:2748`).

**C++ with prebuilt binaries for 5.8**
- [V] Relinking the Development and Shipping game exe is unavoidable.
- [V] Prebuilt static libraries sit in the plugin's `Intermediate/Build/Win64/x64/UnrealGame/{Development,Shipping}`.
  [I] UBT links them without compiling if the project's `Intermediate` is kept and the build is incremental.
- [I] The editor (cook, typings) loads the plugin's ready `UnrealEditor-*.dll` and compiles nothing.

**C++ from source only**
- [I] Compiled once, then treated as prebuilt: `RunUAT BuildPlugin` into a shared cache keyed by the plugin's hash.

**What does not help**
- [V] `-plugin=` (`PluginManager.cpp:114`) and `AdditionalPluginDirectories` (`ProjectDescriptor.cpp:163-165`) only add
  `.uplugin` search paths; a monolithic exe does not load modules from them. `AddPluginSearchPath`
  (`IPluginManager.h:486`) is usable for content at runtime.
- [I] `EnabledByDefault: true` avoids touching `.uproject` (editing it changes the key).
- [V] `engineIdentity` hashes only `Build.version` and BuildId (`runtime.mjs:26-30`): installing into
  `Engine/Plugins/Marketplace` does not change the key, enabling it in `.uproject` does.

## Recommended path

1. Third-party plugins out of the runtime key: `SOURCES` (`runtime.mjs:12`) lists `Plugins/Puerts` and
   `Plugins/VgeLive` instead of `Plugins`; third-party plugins in their own folder (name to be agreed).
2. Content plugins with no rebuild: generalize `createContentPipeline` (`pipeline.mjs:24`) to any plugin name (own
   `-dlcname`, `mountPath`, `-CreateDLCContainer`, `Saved/Containers`, cooked against `Releases/dev`); in
   `UVgeGameInstance::MountContent` register the plugin with `AddToPluginsList` + `MountExplicitlyLoadedPlugin`
   before `FindPlugin`, after `GameFeaturePluginStateMachine.cpp:2716-2763`. One C++ change and one runtime
   rebuild; after that each content plugin is one DLC cook and pak. Release: pak next to the Shipping exe and
   mounted the same way, or the plugin included in the cook (`build.mjs:118-132`).
3. C++ plugins: a separate part of the key and an incremental build. When only that part changes, seed the new
   runtime folder from its parent (its `Intermediate`, `Saved/Cooked`, `Content/Vge/Materials`); keep
   `Intermediate` and `Saved/Cooked` of at least the latest runtime in `pruneBuildLeftovers`. `buildTargets` then
   mostly links; skip the editor target for a runtime-only plugin with ready DLLs [I]; `packageBase` with
   `-iterate`, and `-skipcook` for a plugin without content [I]; no `masterMaterials` or `buildShell`. Plugins from
   source built once with `RunUAT BuildPlugin` into `~/.vge/Plugins/<hash>`.

## Fab: what arrives and how it gets into the game

Research of 2026-10-24 (second pass), reading only.

What is on disk:
- [V] The launcher downloads into `C:\ProgramData\Epic\EpicGamesLauncher\VaultCache\<Name><hash>V1\`: `manifest`
  (BuildPatchServices) and `data\` with the files. Library index: `VaultCache\FabLibrary\listings_v1.db`.
- [V] An asset pack is `data\Content\<Pack>\...`; its internal references are absolute (`/Game/<Pack>/...`) and it is
  self-contained (it carries its own copies, for example its own Mannequins).
- [V] The engine's Fab plugin puts a pack under `FPaths::ProjectDir()` (`Engine/Plugins/Fab/Source/Fab/Private/
  Workflows/PackImportWorkflow.cpp:36`) and a plugin into `Plugins/Marketplace/<Name>` or
  `Engine/Plugins/Marketplace/<Name>` (`PluginInstallWorkflow.cpp:36-42`, `:186-190`), then enables it in `.uproject`.
- [V] The `.uasset` header records the saving engine version (`++UE5+Release-5.8`, `5.5`); 5.8 cannot load assets
  saved by a newer version.

Getting it without the launcher or the editor:
- [V] Downloads go through `BuildPatchInstallerLib` with a manifest and CDN URLs handed out by the Fab web page after
  sign-in (`FabDownloader.cpp:33-67`, `:312-357`). Third-party CLIs (UEVaultManager, Legendary) use an unofficial
  Epic API: not proposed.
- [V] Fab documentation: UE formats are not downloadable with Download, only Add to Project / Create Project / Install
  Plugin; FBX/glTF/OBJ/USD download directly
  (https://dev.epicgames.com/documentation/en-us/fab/exporting-assets-from-fab-in-launcher).
- [V] Licence summary: commercial use in projects allowed, redistributing an asset on its own is not
  (https://dev.epicgames.com/documentation/fab/licenses-and-pricing-in-fab). [I] Pack sources never go into the public
  repository (gitignored, like `Content/Characters/Mannequins`).
- [I] Legitimate path: the user adds the item through the launcher or fab.com, a kit command copies it out of
  VaultCache.

Asset pack into the game without the editor:
- [V] Precedent: Mannequins are copied into `Content/Characters/Mannequins` (`dev/tools/runtime.mjs:88-95`), gitignored
  so outside the runtime key, and cooked into the base through `DirectoriesToAlwaysCook` (`Config/DefaultGame.ini:19-20`;
  Config is in the key, so adding a pack to the base means a new key).
- [V] The content pipeline only handles the VgeLive plugin: `-dlcname=VgeLive` (`pipeline.mjs:56`), pak list from
  `cookedPlugin/Content` only (`:124`), mount under `Plugins/VgeLive` (`:87`), `cookedRoot` wiped on each build (`:111`).
- [V] A DLC cook does not forbid packages outside the plugin unless `bErrorOnEngineContentUse` is set
  (`CookRequestCluster.cpp:2856`). [I] Nothing in the plugin references `/Game/<Pack>`, so the pack's packages must be
  passed to the cook explicitly; `/Game` needs no registration (the mount point exists).
- [V] A DLC's shader library is written under the DLC plugin's name (`Cooker/ShaderLibraryCooking.cpp:587`) and
  `MountContent` opens it only for a plugin it finds (`VgeGameInstance.cpp:121-125`). [I] A pack is cooked under a
  registered DLC name, or `MountContent` opens the library by name without `FindPlugin`.
- [I] Each pack gets its own cook folder, container name and `Saved/Containers`, so an edit to a `.glb` does not
  re-cook gigabytes of pack content.
- [I] Release: a pack referenced only by string paths from TS is not cooked unless listed explicitly.

TypeScript:
- [V] Loading by path already works (`UE.Object.Load`, `loadContent<T>` in `dev/src/shared/engine/content.ts:60-64`);
  `useContentAsset` / `useContentMesh` are tied to imported `.glb/.gltf/.fbx` files and the VgeLive manifest.
- [V] Puerts generates types for content Blueprints, structs and enums into `Typing/ue/ue_bp.d.ts`
  (`DeclarationGenerator.cpp:407-433`) during the `typings` step. [I] A pack mounted later as DLC gets no types until the
  generator runs for it; mesh and texture paths are untyped strings.

From Fab to the game, by kind:
- Asset pack (UE format): add to library, launcher downloads; a kit command copies `data\Content\<Pack>` to
  `Content/<Pack>`, checks the saved version (≤ 5.8) and needed plugins, gitignores it; its own DLC container (explicit
  package list, mount `Content/<Pack>`), mounted by `MountContent`; TS loads `/Game/<Pack>/...`. To change:
  `pipeline.mjs:18`, `:56`, `:87`, `:111`, `:124-131` parameterised; `VgeGameInstance.cpp:121-125` opens the shader
  library by DLC name; a pack manifest and event next to `dev/src/shared/react/content.ts:77-97`.
- FBX/glTF from Fab: already works (`import x from './x.glb'`, content pipeline into VgeLive).
- Content-only `.uplugin`: as in "Recommended path" 2 above.
- C++ plugin: as in "Recommended path" 3 above; Fab installs into `Plugins/Marketplace/<Name>`, so that folder stays out
  of `SOURCES` (`runtime.mjs:12`).

Not checked in this pass: cook flags for an explicit package list in a DLC cook and where cooked `/Game` packages land;
`/Game` packages inside a DLC IoStore container; the full Fab EULA (403); Fab's requirements for code plugins; whether the
launcher's Add to Project accepts this project (`EngineAssociation` 5.8).

## Not checked

- Whether the DLC cook picks up content referenced across plugins.
- The `-iterate` and `-skipcook` flags in the UAT code.
- Whether UBT builds incrementally in a seeded copy: its manifests hold absolute paths, so a copy under another
  key may rebuild from scratch; one fixed build folder per machine may be needed.
