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

## Not checked

- Whether the DLC cook picks up content referenced across plugins.
- The `-iterate` and `-skipcook` flags in the UAT code.
- Whether UBT builds incrementally in a seeded copy: its manifests hold absolute paths, so a copy under another
  key may rebuild from scratch; one fixed build folder per machine may be needed.
