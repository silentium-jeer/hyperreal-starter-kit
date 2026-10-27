---
name: threejs-precipitation-surfaces
description: Web renderer version (three.js), NOT PORTED to this Unreal kit. In the web kit it coupled rain or snow with the surfaces it visibly changes — precipitation volumes, wind, accumulation, wetness, puddles, ripples, splashes, snow caps and shared weather state. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-precipitation-surfaces — not ported

This is a stub. The web starter kit's skill of this name is specific to the web
renderer (three.js particles and shader uniforms), so its content was not copied
into the Unreal Starter Kit. Source: the web starter kit,
`agents/skills/threejs-precipitation-surfaces/`.

**What it covered in the web kit:** one weather state driving both the falling
particles and the surfaces they change (wet, puddled, snow-capped), so the two can
never disagree.

**What the Unreal equivalent would cover:** a weather state owned in `src`
that drives a particle system for the precipitation and global material
parameters for wetness and accumulation on surfaces, with the state readable
through `node vge/tools/game.mjs` and forced through the debug seam.

**Until it is ported:** `world-debug-seam` (force the weather state, do not wait
for it), `visual-verification-gate`.
