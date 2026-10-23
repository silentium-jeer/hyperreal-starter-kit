#include "VgeImporter.h"

#include "AssetImportTask.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetToolsModule.h"
#include "Animation/Skeleton.h"
#include "Engine/StaticMesh.h"
#include "InterchangeGenericAssetsPipeline.h"
#include "InterchangeGenericAssetsPipelineSharedSettings.h"
#include "InterchangeManager.h"
#include "FileHelpers.h"
#include "HAL/FileManager.h"
#include "Materials/Material.h"
#include "Materials/MaterialInstanceConstant.h"
#include "Misc/PackageName.h"
#include "ObjectTools.h"
#include "UObject/UObjectGlobals.h"

DEFINE_LOG_CATEGORY_STATIC(LogVgeImport, Log, All);

const TArray<FString>& VgeImporter::GltfMasterNames()
{
	static const TArray<FString> Names = { TEXT("M_Default"), TEXT("M_ClearCoat"), TEXT("M_Sheen"), TEXT("M_SpecularGlossiness"), TEXT("M_Transmission"), TEXT("M_Unlit") };
	return Names;
}

UMaterial* VgeImporter::FindProjectMaster(const UMaterial* InterchangeMaster)
{
	if (!InterchangeMaster || !InterchangeMaster->GetPathName().StartsWith(GltfMasterSourcePath))
	{
		return nullptr;
	}
	const FString Name = InterchangeMaster->GetName();
	return LoadObject<UMaterial>(nullptr, *FString::Printf(TEXT("%s/%s.%s"), GltfMasterProjectPath, *Name, *Name), nullptr, LOAD_NoWarn);
}

namespace
{
	// Runs one automated import task; Options is null for the project's default pipeline stack.
	TArray<UObject*> RunImportTask(const FString& Source, const FString& Dest, UObject* Options)
	{
		UAssetImportTask* Task = NewObject<UAssetImportTask>();
		Task->AddToRoot();
		Task->Filename = Source;
		Task->DestinationPath = Dest;
		Task->bAutomated = true;
		Task->bReplaceExisting = true;
		Task->bSave = false;
		Task->Options = Options;
		FAssetToolsModule::GetModule().Get().ImportAssetTasks({ Task });
		TArray<UObject*> Objects = Task->GetObjects();
		Task->RemoveFromRoot();
		return Objects;
	}

	TSharedRef<FJsonObject> SaveAndReport(const TArray<UObject*>& Imported, const FString& Source, const FString& Dest)
	{
		TArray<TSharedPtr<FJsonValue>> Objects;
		TArray<UPackage*> Packages;
		for (UObject* Object : Imported)
		{
			if (!Object)
			{
				continue;
			}
			Packages.AddUnique(Object->GetPackage());
			TSharedPtr<FJsonObject> Entry = MakeShared<FJsonObject>();
			Entry->SetStringField(TEXT("path"), Object->GetPathName());
			Entry->SetStringField(TEXT("class"), Object->GetClass()->GetName());
			Objects.Add(MakeShared<FJsonValueObject>(Entry));
			UE_LOGF(LogVgeImport, Display, "Imported %ls (%ls)", *Object->GetPathName(), *Object->GetClass()->GetName());
		}

		const bool bSaved = Packages.Num() > 0 && UEditorLoadingAndSavingUtils::SavePackages(Packages, false);
		if (!bSaved)
		{
			UE_LOGF(LogVgeImport, Error, "Nothing imported or saved from %ls", *Source);
		}

		TSharedRef<FJsonObject> Report = MakeShared<FJsonObject>();
		Report->SetStringField(TEXT("source"), Source);
		Report->SetStringField(TEXT("dest"), Dest);
		Report->SetBoolField(TEXT("saved"), bSaved);
		Report->SetArrayField(TEXT("objects"), Objects);
		return Report;
	}
}

TSharedRef<FJsonObject> VgeImporter::ImportAnimations(const FString& Source, const FString& Dest, const FString& SkeletonPath)
{
	USkeleton* Skeleton = LoadObject<USkeleton>(nullptr, *SkeletonPath);
	if (!Skeleton)
	{
		TSharedRef<FJsonObject> Report = MakeShared<FJsonObject>();
		Report->SetStringField(TEXT("error"), FString::Printf(TEXT("skeleton %s not found"), *SkeletonPath));
		return Report;
	}
	// A transient generic pipeline as the whole stack, the way InterchangeMeshUtilities overrides it.
	UInterchangeGenericAssetsPipeline* Pipeline = NewObject<UInterchangeGenericAssetsPipeline>(GetTransientPackage());
	Pipeline->ClearFlags(RF_Standalone | RF_Public);
	Pipeline->CommonSkeletalMeshesAndAnimationsProperties->bImportOnlyAnimations = true;
	Pipeline->CommonSkeletalMeshesAndAnimationsProperties->Skeleton = Skeleton;
	UInterchangePipelineStackOverride* Override = NewObject<UInterchangePipelineStackOverride>();
	Override->AddPipeline(Pipeline);
	Pipeline->AddToRoot();
	const TArray<UObject*> Imported = RunImportTask(Source, Dest, Override);
	Pipeline->RemoveFromRoot();
	return SaveAndReport(Imported, Source, Dest);
}

TSharedRef<FJsonObject> VgeImporter::Import(const FString& Source, const FString& Dest)
{
	const TArray<UObject*> Imported = RunImportTask(Source, Dest, nullptr);

	// Material instances first, so meshes built below already see their final materials.
	for (UObject* Object : Imported)
	{
		UMaterialInstanceConstant* Instance = Cast<UMaterialInstanceConstant>(Object);
		UMaterial* InterchangeMaster = Instance && Instance->Parent ? Instance->Parent->GetMaterial() : nullptr;
		if (UMaterial* ProjectMaster = FindProjectMaster(InterchangeMaster))
		{
			Instance->Modify();
			Instance->SetParentEditorOnly(ProjectMaster);
			Instance->PostEditChange();
		}
		else if (InterchangeMaster && InterchangeMaster->GetPathName().StartsWith(GltfMasterSourcePath))
		{
			UE_LOGF(LogVgeImport, Error, "%ls uses %ls, which has no project copy; run -run=VgeMaterials", *Instance->GetPathName(), *InterchangeMaster->GetPathName());
		}
	}

	for (UObject* Object : Imported)
	{
		if (UStaticMesh* Mesh = Cast<UStaticMesh>(Object))
		{
			Mesh->Modify();
			FMeshNaniteSettings Settings = Mesh->GetNaniteSettings();
			Settings.bEnabled = true;
			Mesh->SetNaniteSettings(Settings);
			Mesh->PostEditChange();
		}
	}
	return SaveAndReport(Imported, Source, Dest);
}

int32 VgeImporter::DeleteContentPath(const FString& ContentPath)
{
	IAssetRegistry& AssetRegistry = FAssetRegistryModule::GetRegistry();
	TArray<FAssetData> Assets;
	AssetRegistry.GetAssetsByPath(FName(*ContentPath), Assets, /*bRecursive*/ true);

	TArray<UObject*> Loaded;
	TSet<FName> PackageNames;
	for (const FAssetData& Asset : Assets)
	{
		PackageNames.Add(Asset.PackageName);
		if (UObject* Object = Asset.GetAsset())
		{
			Loaded.Add(Object);
		}
	}
	if (Loaded.Num() > 0)
	{
		ObjectTools::ForceDeleteObjects(Loaded, /*ShowConfirmation*/ false);
	}

	// ForceDeleteObjects removes what it loaded; anything left on disk under the path goes too.
	FString Directory;
	if (FPackageName::TryConvertLongPackageNameToFilename(ContentPath / TEXT(""), Directory))
	{
		IFileManager::Get().DeleteDirectory(*Directory, /*RequireExists*/ false, /*Tree*/ true);
		AssetRegistry.ScanPathsSynchronous({ ContentPath }, /*bForceRescan*/ true);
	}
	UE_LOGF(LogVgeImport, Display, "Deleted %d packages under %ls", PackageNames.Num(), *ContentPath);
	return PackageNames.Num();
}
