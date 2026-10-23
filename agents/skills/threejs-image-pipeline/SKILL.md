---
name: threejs-image-pipeline
description: Web renderer version (three.js), NOT PORTED to this Unreal kit. In the web kit it designed an explicit HDR image pipeline — ambient occlusion, atmosphere, transparency, bloom, exposure, tone mapping, grading, render targets and post passes in a deliberate order. Load it only to learn that the Unreal version does not exist yet.
---

# threejs-image-pipeline — not ported

This is a stub. The web starter kit's skill of this name is specific to the web
renderer (three.js render targets and post-processing passes), so its content was
not copied into the Unreal Starter Kit. Source: the web starter kit,
`agents/skills/threejs-image-pipeline/`.

**What it covered in the web kit:** building the frame's image chain by hand —
which pass runs in which colour space, where exposure and tone mapping happen,
how transparency, atmosphere, AO and bloom are ordered.

**What the Unreal equivalent would cover:** configuring the engine's existing
chain rather than writing one — post-process settings (exposure / eye adaptation,
bloom, tone mapping, grading), the sky atmosphere and sky light the lab stage
spawns, scalability levels (nothing in the kit sets them yet), and how a scene or lab owns those settings without each lab inventing its
own.

**Until it is ported:** `dev-lab-authoring` rule 2 (lighting conventions live in
the shared lab stage), `visual-verification-gate`.
