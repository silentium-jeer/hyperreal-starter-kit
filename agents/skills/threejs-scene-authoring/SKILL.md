---
name: threejs-scene-authoring
description: Web renderer version (three.js / react-three-fiber), NOT PORTED to this Unreal kit. In the web kit it was the mandatory skill for laying out scenes by hand — every transform chosen deliberately, a headed screenshot after each placement step. Load it only to learn that the Unreal version does not exist yet and which rules still apply.
---

# threejs-scene-authoring — not ported

This is a stub. The web starter kit's skill of this name is specific to the web
renderer (three.js scene graph, react-three-fiber components, headed browser
captures), so its content was not copied into the Unreal Starter Kit. Source: the
web starter kit, `agents/skills/threejs-scene-authoring/`.

**What it covered in the web kit:** how to build and lay out a scene by hand —
placing buildings, props, terrain features and figures one intent at a time, with
every position, rotation and scale chosen for the composition and the reference,
and a headed screenshot after each step.

**What the Unreal equivalent would cover:** authoring a scene in
`dev/src/scenes/<scene>/` as explicit `spawn(...)` / `meshActor(...)` calls with
authored coordinates (centimetres, Z up), composed with the lab-stage camera
before the player is mounted, each placement step hot-reloaded into the running
game and checked in a capture of the rendered window; prefabs as local-coordinate
groups moved as one unit; root scale `[1, 1, 1]`.

**Until it is ported, these still apply in full:** AGENTS.md rule 3 (scenes are
always authored by hand, never generated), the Scene-Fidelity Invariant in
`agents/AGENTS.md`, `gameplay-space-composition`, `visual-verification-gate`,
`dev-lab-authoring`.
