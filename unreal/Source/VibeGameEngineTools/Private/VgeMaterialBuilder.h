#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

// Materials described in TypeScript (src/shared/material, `*.material.tsx` modules) made into assets by the
// resident content service, the way the material editor makes them: UMaterialEditingLibrary creates the expressions
// and connects them, the material's settings and usages are its own properties, and the package is saved for the
// cook to compile its shaders.
namespace VgeMaterialBuilder
{
	// Request (vge/content/materials.mjs):
	//   path      "/VgeLive/Materials/Lava_1a2b3c4d/Lava": the package; the asset is named after its last segment
	//   settings  { blendMode: "Opaque", shadingModel: "DefaultLit", twoSided: true, ... }: UMaterial properties by
	//             name (any case), enum values by name with or without their prefix (BLEND_Opaque or Opaque)
	//   usage     ["InstancedStaticMeshes", "Nanite", ...]: EMaterialUsage by name (MATUSAGE_ optional)
	//   nodes     [{ class: "MaterialExpressionMultiply", props: { constA: 1 }, inputs: { a: { node: 2, output: "" } } }]:
	//             expressions; an input is named after its property (A, Coordinates) or its pin (a Custom input's name)
	//   outputs   { baseColor: { node: 3, output: "RGB" } }: material inputs by EMaterialProperty name (MP_ optional)
	// Returns { path, class, saved } or { error }.
	TSharedRef<FJsonObject> BuildMaterial(const TSharedPtr<FJsonObject>& Request);

	// Request: { path, parent: "<object path of a material>", scalar: { name: 1 }, vector: { name: [r, g, b, a] },
	// texture: { name: "<texture object path>" } }. A constant instance that overrides parameter values only (no static
	// switch, no base property), so it shares its parent's shaders and its cook compiles nothing.
	// Returns { path, class, saved } or { error }.
	TSharedRef<FJsonObject> BuildMaterialInstance(const TSharedPtr<FJsonObject>& Request);
}
