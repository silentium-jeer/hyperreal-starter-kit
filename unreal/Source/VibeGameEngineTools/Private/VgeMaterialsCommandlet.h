#pragma once

#include "Commandlets/Commandlet.h"
#include "VgeMaterialsCommandlet.generated.h"

// Creates the project's copies of Interchange's glTF master materials with every usage live content needs
// (skeletal meshes, morph targets, Nanite, instancing), so their shaders are cooked into the base game.
// Imported material instances are reparented onto these copies (VgeImporter): a DLC cannot add
// shaders to a master material the base game already cooked.
//   UnrealEditor-Cmd.exe VibeGameEngine.uproject -run=VgeMaterials
UCLASS()
class UVgeMaterialsCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	virtual int32 Main(const FString& Params) override;
};
