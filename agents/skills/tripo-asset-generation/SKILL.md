---
name: tripo-asset-generation
description: Generate game props from image references through Tripo MCP. Use for Tripo image-to-3D work, especially batches of small props prepared on a shared reference sheet; character rigging continues in tripo-to-mixamo.
---

# Tripo asset generation

Use image-driven generation. Never call text-to-3D generation: prepare or obtain the visual reference first.

For a requested Blender import, part separation, or garment-on-mannequin handoff, follow [tripo-blender-fast-handoff](../tripo-blender-fast-handoff/SKILL.md) before moving to engine labs or physics. A single GLB mesh can contain disconnected parts; inspect connectivity before ordering segmentation. Show the requested Blender result before proceeding to integration.

## Small props: one sheet, one HD batch

For collections of small props, prepare them together on one high-resolution reference sheet and send the entire sheet to Tripo in one image-to-3D job. Prefer the HD pipeline for these batches: it is the user's faster, cheaper choice for small assets where Smart Mesh topology is unnecessary. Do not generate each small item in its own Smart Mesh job.

- Group related props that need similar detail and scale: food portions, bread, fruit, utensils, bottles, books or tabletop clutter.
- Give each item a distinct silhouette and enough clear space to separate it from its neighbours. Use consistent viewing angle, neutral lighting and a plain background; do not let shadows or a decorative backdrop connect the items.
- Use the highest practical native image resolution and check the actual output dimensions. Keep enough source pixels per item; split an overcrowded sheet into a few sensible batches rather than accepting unreadable details. Upscaling alone does not add source detail.
- Keep a sheet manifest identifying every item and its intended metric size. Save the sheet, the raw generated model and its textures before extraction.
- Generate from that image with pipeline `hd`, with textures/PBR when available. Follow explicit task quality settings; do not silently switch the pipeline.
- Extract the resulting objects by their authored sheet regions and connected geometry. Preserve their UVs, shared texture atlas and materials. Retain intentional multi-part objects; do not blindly split every disconnected fruit stem or handle.
- Inspect every extracted item for fused neighbours, missing backs, floating islands, bad normals and baked background geometry. Repair the actual defect and preserve the raw source.
- Bake each item's metric dimensions and floor/support pivot into geometry; entity roots stay at unit scale. Import through the project's asset optimizer and instance repeated items by geometry/material.

A single large or intricate object, such as a hero vessel, character or elaborate centrepiece, can be generated separately. Choose Smart Mesh when its topology or editing needs justify it; the small-prop HD preference does not change the tool's general Smart Mesh default.

## Assembly and proof

Inspect the real 3D outputs in an isolated headed lab, then in the target scene. A good source sheet is not proof that the generated meshes are usable. Check physical fit with neighbouring objects and preserve useful placement variation without intersections.

Batching generation saves generation time and credits; rendering is a separate concern. Reuse geometry/materials and the project's instancing or mesh batching system. Do not create one draw call for every copy.

For character rigging and untouched animation imports, continue with [tripo-to-mixamo](../tripo-to-mixamo/SKILL.md). For exact hand-built reconstructions, use [reference-to-3d](../reference-to-3d/SKILL.md).

