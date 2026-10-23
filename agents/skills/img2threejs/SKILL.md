---
name: img2threejs
description: Web renderer version (three.js), NOT PORTED to this Unreal kit. In the web kit it turned an object or character reference image into a quality-gated, animation-ready procedural three.js model built in code (staged intake, spec, build, review, rig). Load it only to learn that the Unreal version does not exist yet and which skills reach the same goal here.
---

# img2threejs — not ported

This is a stub. The web starter kit's `img2threejs` (a large skill with its own
staged toolchain) generates three.js code, so none of it was copied into the
Unreal Starter Kit. Source: the web starter kit, `agents/skills/img2threejs/`.

**What it covered in the web kit:** image-to-3D reconstruction as code — a
reference image read into a sculpt spec, built as procedural three.js geometry
and materials in stages, reviewed against the reference, and rigged for animation.

**What the Unreal equivalent would cover:** reference image to an asset that
reaches the engine as content — reconstructed in Blender or by a generation
service, exported as glTF beside the feature that imports it, built by the content pipeline,
reviewed in a lab against the reference. The engine does not build models from
code in this kit.

**Until it is ported, the same goal is reached with:** `reference-to-3d`,
`text-to-blender`, `wireframe-to-3d`, `blender-mcp-hand-modeling`,
`tripo-asset-generation`, `tripo-blender-fast-handoff`, `blender-web-pipeline`,
`asset-optimization-pipeline`.
