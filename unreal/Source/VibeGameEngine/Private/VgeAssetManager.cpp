#include "VgeAssetManager.h"

#include "Misc/PackageName.h"

#if WITH_EDITOR
TArray<FString> UVgeAssetManager::DlcCookFolders;

void UVgeAssetManager::ModifyDLCCook(const FString& DLCName, TConstArrayView<const ITargetPlatform*> TargetPlatforms,
	TArray<FName>& PackagesToCook, TArray<FName>& PackagesToNeverCook)
{
	// The stock list: every package file under the plugin's content (AssetManager.cpp ModifyDLCCook).
	Super::ModifyDLCCook(DLCName, TargetPlatforms, PackagesToCook, PackagesToNeverCook);
	if (DlcCookFolders.IsEmpty())
	{
		return;
	}

	// The stock list holds file names; a package is kept when its long name lies in one of the build's folders.
	const int32 Listed = PackagesToCook.Num();
	PackagesToCook.RemoveAll([](const FName& File)
	{
		FString PackageName;
		if (!FPackageName::TryConvertFilenameToLongPackageName(File.ToString(), PackageName))
		{
			PackageName = File.ToString();
		}
		PackageName += TEXT("/");
		return !DlcCookFolders.ContainsByPredicate([&PackageName](const FString& Folder)
		{
			return PackageName.StartsWith(Folder);
		});
	});
	UE_LOGF(LogTemp, Display, "VgeAssetManager: DLC cook of %ls limited to %d of %d packages (%ls)", *DLCName,
		PackagesToCook.Num(), Listed, *FString::Join(DlcCookFolders, TEXT(", ")));
}
#endif
