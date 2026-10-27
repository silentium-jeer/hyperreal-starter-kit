---
name: webgl-dropped-draw-audit
description: Web renderer version (WebGL / three.js), NOT PORTED to this Unreal kit. In the web kit it caught draws the GPU driver silently rejects — a render state its shaders were not compiled for does not throw, often does not warn, and the driver just drops the draw. Load it only to learn that the Unreal version does not exist yet.
---

# webgl-dropped-draw-audit — not ported

This is a stub. The web starter kit's skill of this name audits WebGL draw calls,
so its content was not copied into the Unreal Starter Kit. Source: the web
starter kit, `agents/skills/webgl-dropped-draw-audit/`.

**What it covered in the web kit:** finding draws that silently produce nothing
because the program was compiled for a different state than the one it is used
in, by counting what was submitted against what was drawn.

**What the Unreal equivalent would cover:** the engine's silent-substitution
cases — a mesh drawn with a material that lacks the usage it needs, which the
engine replaces rather than failing (the reason this kit makes project copies of
Interchange's glTF masters with skeletal and Nanite usage, README "Engine
notes"), shaders missing from a cooked shader library, and how to read those from
the game log and from the objects themselves through `node vge/tools/game.mjs`
instead of from a frame.

**Until it is ported:** AGENTS.md rule 2b (read the code and the numbers first),
`asset-optimization-pipeline`.
