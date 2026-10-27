#pragma once

#include "CoreMinimal.h"
#include "Engine/AssetManager.h"
#include "VgeAssetManager.generated.h"

// The project's asset manager (DefaultEngine.ini AssetManagerClassName). Its one change is to the DLC cook of live
// content: each imported file is cooked into a container of its own (vge/content/pipeline.mjs), so a cook of the
// VgeLive plugin takes only the content folders of that build, not every package the plugin holds.
UCLASS()
class VIBEGAMEENGINE_API UVgeAssetManager : public UAssetManager
{
	GENERATED_BODY()

public:
#if WITH_EDITOR
	// Content folders (/VgeLive/FlightCase_b0051/) the next DLC cook is limited to; empty cooks the whole plugin, as
	// the stock asset manager does. Set by the VgeCook commandlet for each cook request.
	static TArray<FString> DlcCookFolders;

	virtual void ModifyDLCCook(const FString& DLCName, TConstArrayView<const ITargetPlatform*> TargetPlatforms,
		TArray<FName>& PackagesToCook, TArray<FName>& PackagesToNeverCook) override;
#endif
};
