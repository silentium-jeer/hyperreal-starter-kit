---
name: threejs-procedural-vfx
description: Web renderer version (three.js), NOT PORTED to this Unreal kit. In the web kit it built readable, event-driven realtime VFX — impacts, trails, sparks, plasma, dissolves, wakes, debris — with explicit event state, pooled lifetime ownership, coherent motion and HDR-aware shading. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-procedural-vfx — not ported

This is a stub. The web starter kit's skill of this name is written against
three.js meshes, particles and shaders, so its content was not copied into the
Unreal Starter Kit. Source: the web starter kit,
`agents/skills/threejs-procedural-vfx/`.

**What it covered in the web kit:** effects triggered by gameplay events, owning
their lifetime in a pool, moving coherently, and shaded for an HDR frame so they
read without blowing out.

**What the Unreal equivalent would cover:** event-driven particle systems spawned
from `dev/src` gameplay code, their lifetime owned by the scene scope
(`dev/src/shared/engine/world.ts`) so a scene switch or reload removes them, and
their readability judged in a rendered window.

**Until it is ported:** `fixed-tick-gameplay` (event state belongs to the
simulation), `motion-design` role, `visual-verification-gate`.
