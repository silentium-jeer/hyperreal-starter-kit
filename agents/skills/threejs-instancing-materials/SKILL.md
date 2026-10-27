---
name: threejs-instancing-materials
description: Web renderer version (three.js / WebGL and WebGPU), NOT PORTED to this Unreal kit. In the web kit it kept repeated 3D objects and materials cheap — instancing, shared materials, avoiding per-object material and geometry copies — on both of that kit's renderers. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-instancing-materials — not ported

This is a stub. The web starter kit's skill of this name is specific to the web
renderers (react-three-fiber WebGL canvas and the WebGPU engine), so its content
was not copied into the Unreal Starter Kit. Source: the web starter kit,
`agents/skills/threejs-instancing-materials/`.

**What it covered in the web kit:** drawing many copies of one object as one
instanced draw, sharing one material between objects instead of cloning it, and
the measured cost of getting either wrong.

**What the Unreal equivalent would cover:** instanced and hierarchical instanced
static mesh components for repeated objects, Nanite's handling of repeated
meshes, sharing material instances instead of creating one per actor (in this
kit `colored()` in `src/shared/engine/world.ts` creates a new dynamic material
instance on every call — the place such a rule would first apply), and how to
measure the difference in a rendered process.

**Until it is ported:** the `optimization` role, `asset-optimization-pipeline`,
AGENTS.md rule 3 (repetition is still authored placement, never a scatter loop).
