---
name: blender-web-pipeline
description: Blender to glTF export workflows that feed this Unreal kit's live content pipeline (a .glb saved beside the feature that owns it and imported by game code is decoded, imported with Nanite, cooked and mounted into the running game). Use this skill when exporting Blender models or animations for the game, batch processing models with bpy scripts, automating Blender export, or preparing a character with several mesh parts. Triggers on Blender glTF export, bpy scripting, export settings, texture baking, batch export, "get this model into the game", "import a .glb". The skill keeps its web-kit name; its web delivery targets (three.js, Babylon.js, file-size budgets) do not apply here.
---

# Blender Web Pipeline (Unreal kit)

## Overview

The web kit's version of this skill exported Blender models to web-optimized
glTF for three.js / Babylon.js. In this kit glTF 2.0 is still the hand-off
format, but the consumer is Unreal Engine 5.8 through the content pipeline
(`asset-optimization-pipeline`): a model file that game code imports is decoded,
imported by Interchange with Nanite on, DLC-cooked, packaged and mounted into
every running game in a few seconds, and again on every save (README: 4.0–4.6 s from save to the new mesh
in the game).

**When to use this skill:**
- Exporting Blender models or animations for the game
- Batch processing multiple `.blend` files to `.glb`
- Automating repetitive Blender tasks with bpy
- Preparing a character whose body, clothes and hair are separate mesh parts

**What changes against the web kit:**
- The output goes beside the feature that owns it,
  `dev/src/features/<slice>/assets/<name>.glb` (`.gltf` and `.fbx` are also
  accepted, `dev/vite/contentAssetsPlugin.mjs`). It reaches the game only when
  code imports it (`import myModel from '../assets/my-model.glb'`); the import's
  default export is the handle the game addresses it by. Nothing is picked up
  from a folder, and the release build (`npm run build`) contains only imported
  models.
- Compression in the export (Draco, meshopt, quantization, WebP textures) is
  allowed and is kept (AGENTS.md rule 5): the pipeline's decode step rewrites it
  as plain glTF before import because Interchange 5.8 cannot read it. It shrinks
  the source file; it does not change what the engine cooks.
- The web kit's budgets — under 5 MB per model, under 50k triangles, 2048 px
  textures, under 2 s load on an average connection — were web delivery targets.
  They are not this kit's budgets, and the kit has no measured budget of its own
  yet. Do not decimate a static mesh to meet a web number: it is imported with
  Nanite on.
- Lights and cameras are not exported: scenes and labs create them in TypeScript
  (`dev/src/scenes/lab-stage`).

## Core Concepts

### glTF 2.0

```
.gltf = JSON + external .bin + external textures
.glb  = single binary file (preferred: one file per asset, beside its feature)
```

PBR materials (Principled BSDF), animation, skinning and morph targets travel in
glTF. On import, Interchange makes the materials instances of its glTF masters,
and the kit reparents them onto project copies with skeletal and Nanite usage
(README, "Engine notes").

### Blender Python API (bpy)

```python
import bpy

scene = bpy.context.scene
obj = bpy.data.objects['Cube']
obj.location = (0, 0, 1)

bpy.ops.export_scene.gltf(
    filepath='<repo>/dev/src/features/<slice>/assets/cube.glb',
    export_format='GLB'
)
```

### What the game expects from a character

- **Several mesh nodes on one armature import as several skeletal meshes on one
  skeleton**, and the runtime assembles them with `SetLeaderPoseComponent`
  (README; `dev/src/features/character/entities/modularCharacter.ts`). Keep body
  parts as separate mesh objects under one armature when they should be
  swappable.
- Imported glTF characters face local +Y with the pivot at the feet
  (`dev/src/features/character/entities/Player.tsx` rotates the mesh −90 yaw and
  lowers it by the capsule half-height). Keep the origin at the feet; do not bake an offset to compensate
  in Blender.
- Animations arrive as `AnimSequence` objects, listed per asset in the manifest
  (`ContentAsset.animations`, `dev/src/shared/engine/content.ts`).

## Common Patterns

### 1. Export one model for the game

```python
import bpy

bpy.ops.object.select_all(action='DESELECT')
bpy.data.objects['MyModel'].select_set(True)

bpy.ops.export_scene.gltf(
    filepath='<repo>/dev/src/features/<slice>/assets/my-model.glb',
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_colors=True,
    export_cameras=False,
    export_lights=False,
    export_animations=True,
)
```

Saving over a file the game code imports is a new content build: the running
game swaps it in for every `onAsset` / `onMesh` / `useContentMesh` subscriber. A
new file builds only once some code imports it.

### 2. Batch export (headless Blender)

```bash
blender --background --python scripts/batch_export.py -- /path/to/blend/files <repo>/dev/src/features/<slice>/assets
```

`scripts/batch_export.py` opens every `.blend` in a directory and writes one
`.glb` per file. Running Blender in the background is fine for export: the
rendered-window rule (AGENTS.md rule 1) is about judging frames, not about
writing files.

### 3. Texture baking

Bake procedural or layered Blender materials to image textures before export:
custom shader nodes do not survive glTF. Use Cycles bake into an image, assign it
through an Image Texture → Principled BSDF, save the image, export.

```python
import bpy

def bake_textures(obj, resolution=2048):
    bpy.context.scene.render.engine = 'CYCLES'
    bake_image = bpy.data.images.new(name=f"{obj.name}_bake", width=resolution, height=resolution)
    mat = bpy.data.materials.new(name=f"{obj.name}_baked")
    mat.use_nodes = True
    tex_node = mat.node_tree.nodes.new(type='ShaderNodeTexImage')
    tex_node.image = bake_image
    mat.node_tree.nodes.active = tex_node
    if obj.data.materials:
        obj.data.materials[0] = mat
    else:
        obj.data.materials.append(mat)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.bake(type='COMBINED')
    bake_image.filepath_raw = f"//{obj.name}_bake.png"
    bake_image.file_format = 'PNG'
    bake_image.save()
```

### 4. Clean geometry before export

```python
import bpy

bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=0.0001)
bpy.ops.object.mode_set(mode='OBJECT')
```

Apply transforms (Ctrl+A) and modifiers (`export_apply=True`) so the imported
mesh matches what Blender shows.

## Integration with this kit

```ts
import myModel from '../assets/my-model.glb';
import { onMesh, onAsset } from '../../../shared/engine/content';

onMesh(myModel, (mesh) => actor.StaticMeshComponent.SetStaticMesh(mesh));
onAsset(myModel, (asset) => {
  // asset.skeletalMeshes, asset.animations, asset.objects — new on every build
});
```

In a React scene, `useContentMesh(myModel)` / `useContentAsset(myModel)`
(`dev/src/shared/react/content.ts`) do the same.

Show a new asset in a lab first (`dev-lab-authoring`), opened with
`npm run play -- --lab <id>`, and look at it in the rendered window.

## Common Pitfalls

### 1. The asset does not appear in the game
- Read the dev server console (`[content] …`) and the game log
  (`[content] build N mounted …` or `[content] <file>: <message>`); per build,
  `Plugins/VgeLive/Saved/Pipeline/bNNNN/` holds the import, cook, pak and IoStore
  logs.
- Check the import: only a file that loaded game code imports is built
  (`[content] building <key>` in the dev server console).

### 2. Missing textures
- Save images to files (or pack them into the `.glb`); use Image Texture nodes
  wired into Principled BSDF slots glTF understands (Base Color,
  Metallic/Roughness, Normal, Emission, Occlusion).

### 3. Animations missing
- Push actions to the timeline or NLA, export with animations on, bake complex
  rigs ("Bake Actions"). Confirm `asset.animations` is non-empty with
  `node tools/game.mjs`.

### 4. Materials look different
- Use Principled BSDF; custom shader nodes do not export. Judge the look in the
  rendered game window, not in Blender's viewport.

### 5. Wrong facing or floating character
- Origin at the feet, facing +Y on import (see above); fix it in Blender, not with
  an offset in game code.

## Pre-Export Checklist

```
☐ Apply all modifiers
☐ Merge vertices (remove doubles)
☐ UV unwrap all meshes
☐ Bake materials that use custom nodes
☐ Use Principled BSDF materials
☐ Remove unused data (orphan cleanup)
☐ Name objects descriptively; one armature per character, parts as separate meshes
☐ Origin at the feet for characters; transforms applied (Ctrl+A)
☐ Output saved beside the owning feature and imported by its code
```

## Resources

### scripts/ (copied from the web kit)
- `batch_export.py` — batch export `.blend` files to `.glb` (Draco on; kept and
  decoded by the pipeline)
- `optimize_model.py` — decimation; a web-budget tool, not needed for Nanite
  static meshes
- `generate_lods.py` — LOD copies by decimation; a web-budget tool, not needed for
  Nanite static meshes

### references/ (copied from the web kit)
- `gltf_export_guide.md` — every Blender glTF exporter parameter
- `bpy_api_reference.md` — Blender Python API quick reference
- `optimization_strategies.md` — the web kit's optimization techniques; its size,
  triangle and draw-call targets are web targets and do not apply here

### assets/
- `README.md` describes an `export_template.blend` and a `shader_library/` that
  are not included (they were absent in the web kit too).

## Related Skills

- `asset-optimization-pipeline` — what happens to the file after game code
  imports it
- `blender-export`, `blender-materials`, `blender-modeling` and the rest of the
  Blender family — authoring in Blender
- `tripo-blender-fast-handoff`, `tripo-to-mixamo` — generated and rigged
  characters
