#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

class UMaterial;

// Content operations shared by the one-shot VgeImport commandlet and the resident content service.
namespace VgeImporter
{
	// Interchange's glTF master materials and the project's copies that replace them.
	inline const TCHAR* GltfMasterSourcePath = TEXT("/InterchangeAssets/gltf");
	inline const TCHAR* GltfMasterProjectPath = TEXT("/Game/Vge/Materials/Gltf");
	const TArray<FString>& GltfMasterNames();

	// The project copy of an Interchange glTF master, or null when Material is not one of them.
	UMaterial* FindProjectMaster(const UMaterial* InterchangeMaster);

	// Imports Source through Interchange into the Dest content path, enables Nanite on every static mesh it
	// produced, moves material instances onto the project's master materials and saves the packages.
	// Returns the report: source, dest, saved, objects[{path, class}].
	TSharedRef<FJsonObject> Import(const FString& Source, const FString& Dest);

	// Imports only the animations of Source onto an existing skeleton (Interchange's "import only
	// animations" with the skeleton set), into Dest. Returns the same report as Import.
	TSharedRef<FJsonObject> ImportAnimations(const FString& Source, const FString& Dest, const FString& SkeletonPath);

	// Removes every asset under a content path from memory, the asset registry and disk.
	// Returns the number of packages deleted.
	int32 DeleteContentPath(const FString& ContentPath);
}
