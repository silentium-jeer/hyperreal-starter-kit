---
name: threejs-scene-architecture
description: Web renderer version (three.js / react-three-fiber), NOT PORTED to this Unreal kit. In the web kit it covered frame-cost architecture — the scene rendered several times per frame (main, shadow, velocity passes) and the static/dynamic split that keeps invariant work out of the frame. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-scene-architecture — not ported

This is a stub. The web starter kit's skill of this name is specific to the web
renderer (three.js render passes, react-three-fiber re-render cost), so its
content was not copied into the Unreal Starter Kit. Source: the web starter kit,
`agents/skills/threejs-scene-architecture/`.

**What it covered in the web kit:** where frame time goes when one scene is drawn
by several passes, and the split between static content (rendered or cached once)
and dynamic content (updated every frame), so that invariant work is not repeated
per frame.

**What the Unreal equivalent would cover:** the same question in engine terms —
component mobility (static, stationary, movable; the lab stage spawns its lights
and ground as movable), what invalidates cached shadow pages and Lumen data when
something moves, Nanite versus non-Nanite geometry, how often script code touches
actors from `everyFrame`, and how each of these shows up in a measured frame.

**Until it is ported:** the `optimization` role (its knowledge core carries the
mechanisms), `fixed-tick-gameplay`, `world-debug-seam`, AGENTS.md rule 1 (no
frame-cost number from a `-nullrhi` process).
