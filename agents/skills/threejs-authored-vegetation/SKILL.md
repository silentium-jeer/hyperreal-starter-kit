---
name: threejs-authored-vegetation
description: Web renderer version (three.js), NOT PORTED to this Unreal kit. In the web kit it rendered explicitly placed vegetation — grass, trees, vines, foliage — with stable species identity, terrain-aware shading, rooted wind and distance budgets, never with procedural placement. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-authored-vegetation — not ported

This is a stub. The web starter kit's skill of this name is specific to the web
renderer (three.js shaders and instancing), so its content was not copied into
the Unreal Starter Kit. Source: the web starter kit,
`agents/skills/threejs-authored-vegetation/`.

**What it covered in the web kit:** vegetation whose every instance is placed on
purpose, shaded consistently with the terrain it stands on, moved by wind from the
root up, and thinned with distance inside a budget.

**What the Unreal equivalent would cover:** vegetation assets brought in as model files
the owning feature imports, drawn with the engine's foliage paths (instanced and Nanite
foliage), wind and two-sided foliage shading in materials, distance behaviour —
with placement still authored, not scattered.

**Until it is ported:** AGENTS.md rule 3 (no procedural scatter, ever),
`gameplay-space-composition`, `asset-optimization-pipeline`.
