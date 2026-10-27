#include "VgeCookCommandlet.h"

#include "AssetRegistry/AssetRegistryModule.h"
#include "VgeAssetManager.h"
#include "Misc/Parse.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonSerializer.h"
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

	// The request: {"args":["-OutputDir=..."],"scan":["/Game/Pack/"],"folders":["/VgeLive/FlightCase_b0051/"]}
	// (vge/content/cooker.mjs): extra cook arguments, content paths created after this process started, and the
	// content folders a DLC cook is limited to (one build's own container, VgeAssetManager.h).
	FString CookParams = Params;
	TArray<FString> ScanPaths;
	TArray<FString> Folders;
	TSharedPtr<FJsonObject> Request;
	if (FJsonSerializer::Deserialize(TJsonReaderFactory<>::Create(UTF8_TO_TCHAR(Line.c_str())), Request) && Request.IsValid())
	{
		TArray<FString> ExtraArgs;
		Request->TryGetStringArrayField(TEXT("args"), ExtraArgs);
		for (const FString& Arg : ExtraArgs)
		{
			CookParams += TEXT(" ") + Arg;
		}
		Request->TryGetStringArrayField(TEXT("scan"), ScanPaths);
		Request->TryGetStringArrayField(TEXT("folders"), Folders);
	}
	UVgeAssetManager::DlcCookFolders = Folders;

	// The DLC cook lists its packages from disk (UAssetManager::ModifyDLCCook) but checks each one in the asset
	// registry, so content imported after this process started must be rescanned before the cook reads it.
	FString DlcName;
	if (FParse::Value(*Params, TEXT("dlcname="), DlcName))
	{
		ScanPaths.Add(FString::Printf(TEXT("/%s/"), *DlcName));
	}
	AssetRegistry.ScanPathsSynchronous(ScanPaths, /*bForceRescan*/ true);

	// UCookCommandlet is not exported from UnrealEd; reach it through reflection and its virtual Main.
	UClass* CookClass = FindObject<UClass>(nullptr, TEXT("/Script/UnrealEd.CookCommandlet"));
	check(CookClass);
	UCommandlet* Cook = NewObject<UCommandlet>(GetTransientPackage(), CookClass);
	Cook->AddToRoot();
	const int32 Result = Cook->Main(CookParams);
	Cook->RemoveFromRoot();

	std::printf("@@vge {\"event\":\"done\",\"code\":%d}\n", Result);
	std::fflush(stdout);
	return Result;
}
