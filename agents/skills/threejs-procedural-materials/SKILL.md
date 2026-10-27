---
name: threejs-procedural-materials
description: Web renderer version (three.js), NOT PORTED to this Unreal kit. In the web kit it created and visually verified studio-quality generated PBR materials — look development, texture generation, believable wear, anti-tiling, consistent colour, roughness, normals, metalness or transmission. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-procedural-materials — not ported

This is a stub. The web starter kit's skill of this name is written against
three.js materials and shaders, so its content was not copied into the Unreal
Starter Kit. Source: the web starter kit,
`agents/skills/threejs-procedural-materials/`.

**What it covered in the web kit:** producing PBR materials that read as real
(no plastic wood, wear where wear happens, no visible tiling) and accepting them
only from measured and visual evidence.

**What the Unreal equivalent would cover:** materials as they exist in this kit —
imported materials are instances of Interchange's glTF masters reparented onto
project copies with skeletal and Nanite usage (README, "Engine notes"), runtime
tweaks through dynamic material instances (`colored()` in
`src/shared/engine/world.ts`) — plus the look-development and acceptance
discipline of the web skill applied to Unreal materials, judged in a rendered
window under the lab stage's lighting.

**Until it is ported:** `blender-materials`, `reference-look-calibration`,
`dev-lab-authoring`, `visual-verification-gate`.
