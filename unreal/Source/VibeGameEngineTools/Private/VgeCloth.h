#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

class USkeletalMesh;

namespace VgeCloth
{
	TSharedRef<FJsonObject> Build(USkeletalMesh* Mesh, const TSharedPtr<FJsonObject>& Description);
}
