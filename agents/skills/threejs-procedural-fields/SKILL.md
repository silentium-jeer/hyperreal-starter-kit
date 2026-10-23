---
name: threejs-procedural-fields
description: Web renderer version (three.js), NOT PORTED to this Unreal kit. In the web kit it designed coherent, inspectable scalar and vector fields for materials, geometry, terrain, biomes, wetness, displacement and VFX, so several visual channels share one cause instead of stacking unrelated noise. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-procedural-fields — not ported

This is a stub. The web starter kit's skill of this name is written against
three.js shader code, so its content was not copied into the Unreal Starter Kit.
Source: the web starter kit, `agents/skills/threejs-procedural-fields/`.

**What it covered in the web kit:** one field (height, moisture, wear, flow)
defined once and read by every channel that depends on it — albedo, roughness,
displacement, particles — and made visible for inspection.

**What the Unreal equivalent would cover:** the same single-cause fields expressed
as material functions, shared textures or global material parameters, read by
every material and effect that depends on them, with a debug view a lab can
switch on.

**Until it is ported:** `dev-lab-authoring` (inspect the field in a lab),
`visual-verification-gate`.
