#include "VgeCookCommandlet.h"

#include "AssetRegistry/AssetRegistryModule.h"
#include "Misc/Parse.h"
#include "UObject/Package.h"
#include "UObject/UObjectGlobals.h"

#include <cstdio>
#include <iostream>
#include <string>

DEFINE_LOG_CATEGORY_STATIC(LogVgeCook, Log, All);

int32 UVgeCookCommandlet::Main(const FString& Params)
{
	// Finish the asset registry's startup search while waiting, not after the request: otherwise its results
	// land after the rescan below and overwrite it with the state from before this process started.
	IAssetRegistry& AssetRegistry = FAssetRegistryModule::GetRegistry();
	AssetRegistry.SearchAllAssets(/*bSynchronousSearch*/ true);

	std::printf("@@vge {\"event\":\"standby\"}\n");
	std::fflush(stdout);

	std::string Line;
	if (!std::getline(std::cin, Line))
	{
		UE_LOGF(LogVgeCook, Display, "Standby cook released without a request");
		return 0;
	}

	// The DLC cook lists its packages from disk (UAssetManager::ModifyDLCCook) but checks each one in the asset
	// registry, so content imported after this process started must be rescanned before the cook reads it.
	FString DlcName;
	if (FParse::Value(*Params, TEXT("dlcname="), DlcName))
	{
		AssetRegistry.ScanPathsSynchronous({ FString::Printf(TEXT("/%s/"), *DlcName) }, /*bForceRescan*/ true);
	}

	// UCookCommandlet is not exported from UnrealEd; reach it through reflection and its virtual Main.
	UClass* CookClass = FindObject<UClass>(nullptr, TEXT("/Script/UnrealEd.CookCommandlet"));
	check(CookClass);
	UCommandlet* Cook = NewObject<UCommandlet>(GetTransientPackage(), CookClass);
	Cook->AddToRoot();
	const int32 Result = Cook->Main(Params);
	Cook->RemoveFromRoot();

	std::printf("@@vge {\"event\":\"done\",\"code\":%d}\n", Result);
	std::fflush(stdout);
	return Result;
}
