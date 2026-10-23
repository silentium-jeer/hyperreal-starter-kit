---
name: threejs-procedural-architecture
description: Web renderer version (three.js), NOT PORTED to this Unreal kit. In the web kit it built modular architectural ASSETS in code — buildings, ruins, walls, facades, roofs, arches, trim — from an inspectable massing and facade plan, never a scene layout. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-procedural-architecture — not ported

This is a stub. The web starter kit's skill of this name builds three.js geometry
in code, so its content was not copied into the Unreal Starter Kit. Source: the
web starter kit, `agents/skills/threejs-procedural-architecture/`.

**What it covered in the web kit:** a reusable building or kit piece generated
from a written massing and facade plan that can be inspected and edited — the
asset is procedural, its placement in a scene never is.

**What the Unreal equivalent would cover:** the same plan-first discipline for
architecture that reaches the game as content: modelled in Blender (or generated
by a Blender script) from the plan, exported beside the feature that owns it
(`dev/src/features/<slice>/assets/`) and imported by its code, imported with
Nanite by the content pipeline, and placed by hand in a scene.

**Until it is ported:** AGENTS.md rule 3, the Geometry Invariant in
`agents/AGENTS.md` (no bare primitives in final assets), the Blender family of
skills, `blender-web-pipeline`, `asset-optimization-pipeline`.
