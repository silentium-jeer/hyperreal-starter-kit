#include "VgeMaterialsCommandlet.h"

#include "AssetToolsModule.h"
#include "FileHelpers.h"
#include "Materials/Material.h"
#include "VgeImporter.h"

DEFINE_LOG_CATEGORY_STATIC(LogVgeMaterials, Log, All);

int32 UVgeMaterialsCommandlet::Main(const FString& Params)
{
	static const EMaterialUsage Usages[] = { MATUSAGE_SkeletalMesh, MATUSAGE_MorphTargets, MATUSAGE_Nanite, MATUSAGE_InstancedStaticMeshes };

	TArray<UPackage*> Packages;
	for (const FString& Name : VgeImporter::GltfMasterNames())
	{
		UMaterial* Source = LoadObject<UMaterial>(nullptr, *FString::Printf(TEXT("%s/%s.%s"), VgeImporter::GltfMasterSourcePath, *Name, *Name));
		if (!Source)
		{
			UE_LOGF(LogVgeMaterials, Error, "Interchange master %ls not found", *Name);
			return 1;
		}
		UMaterial* Copy = VgeImporter::FindProjectMaster(Source);
		if (!Copy)
		{
			Copy = Cast<UMaterial>(FAssetToolsModule::GetModule().Get().DuplicateAsset(Name, VgeImporter::GltfMasterProjectPath, Source));
		}
		if (!Copy)
		{
			UE_LOGF(LogVgeMaterials, Error, "Could not create the project copy of %ls", *Name);
			return 1;
		}
		for (EMaterialUsage Usage : Usages)
		{
			Copy->SetMaterialUsage(Usage);
			if (!Copy->CheckMaterialUsage(Usage))
			{
				UE_LOGF(LogVgeMaterials, Error, "%ls refused usage %d", *Copy->GetPathName(), static_cast<int32>(Usage));
				return 1;
			}
		}
		Packages.Add(Copy->GetPackage());
		UE_LOGF(LogVgeMaterials, Display, "%ls ready with skeletal, morph target, Nanite and instancing usage", *Copy->GetPathName());
	}
	return UEditorLoadingAndSavingUtils::SavePackages(Packages, false) ? 0 : 1;
}
