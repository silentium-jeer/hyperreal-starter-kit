#include "VgeCloth.h"

#include "ChaosCloth/ChaosClothConfig.h"
#include "ClothingAsset.h"
#include "ClothingAssetFactory.h"
#include "Engine/SkeletalMesh.h"
#include "JsonObjectConverter.h"
#include "Materials/Material.h"
#include "PhysicsEngine/PhysicsAsset.h"
#include "PointWeightMap.h"
#include "Rendering/SkeletalMeshModel.h"
#include "SkeletalMeshClothingSystemUtilities.h"

DEFINE_LOG_CATEGORY_STATIC(LogVgeCloth, Log, All);

namespace
{
	int32 FindSection(const USkeletalMesh* Mesh, const FSkeletalMeshLODModel& Lod, const FString& MaterialName)
	{
		const TArray<FSkeletalMaterial>& Materials = Mesh->GetMaterials();
		for (int32 SectionIndex = 0; SectionIndex < Lod.Sections.Num(); ++SectionIndex)
		{
			const int32 MaterialIndex = Lod.Sections[SectionIndex].MaterialIndex;
			if (!Materials.IsValidIndex(MaterialIndex))
			{
				continue;
			}
			const FSkeletalMaterial& Material = Materials[MaterialIndex];
			if (Material.MaterialSlotName.ToString() == MaterialName || Material.ImportedMaterialSlotName.ToString() == MaterialName)
			{
				return SectionIndex;
			}
		}
		return INDEX_NONE;
	}

	struct FPinRule
	{
		int32 Axis = INDEX_NONE;
		bool bAbove = false;
		float Edge = 0.f;
		float Ramp = 0.f;
	};

	bool ReadPin(const TSharedPtr<FJsonObject>& Section, FPinRule& Rule, FString& Error)
	{
		const TSharedPtr<FJsonObject>* Pin = nullptr;
		if (!Section->TryGetObjectField(TEXT("pin"), Pin))
		{
			Error = TEXT("a cloth section names what is pinned: pin { axis: X|Y|Z, below|above: cm, ramp: cm }");
			return false;
		}
		const FString Axis = (*Pin)->GetStringField(TEXT("axis")).ToUpper();
		Rule.Axis = Axis == TEXT("X") ? 0 : Axis == TEXT("Y") ? 1 : Axis == TEXT("Z") ? 2 : INDEX_NONE;
		double Edge = 0;
		Rule.bAbove = (*Pin)->TryGetNumberField(TEXT("above"), Edge);
		if (Rule.Axis == INDEX_NONE || (!Rule.bAbove && !(*Pin)->TryGetNumberField(TEXT("below"), Edge)))
		{
			Error = TEXT("pin needs axis X, Y or Z and one of below or above");
			return false;
		}
		Rule.Edge = Edge;
		double Ramp = 0;
		(*Pin)->TryGetNumberField(TEXT("ramp"), Ramp);
		Rule.Ramp = Ramp;
		return true;
	}

	TArray<float> Freedom(const FClothPhysicalMeshData& Physical, const FPinRule& Rule, float Scale)
	{
		TArray<float> Values;
		Values.SetNumUninitialized(Physical.Vertices.Num());
		for (int32 Vertex = 0; Vertex < Values.Num(); ++Vertex)
		{
			const float Coordinate = Physical.Vertices[Vertex][Rule.Axis];
			const float Beyond = Rule.bAbove ? Rule.Edge - Coordinate : Coordinate - Rule.Edge;
			const float Free = Beyond <= 0.f ? 0.f : Rule.Ramp > 0.f ? FMath::Min(Beyond / Rule.Ramp, 1.f) : 1.f;
			Values[Vertex] = Free * Scale;
		}
		return Values;
	}

	void SetWeightMap(UClothingAssetCommon* Asset, EWeightMapTargetCommon Target, const TArray<float>& Values)
	{
		FClothLODDataCommon& Lod = Asset->LodData[0];
		FPointWeightMap* Map = Lod.PointWeightMaps.FindByPredicate([Target](const FPointWeightMap& Existing) { return Existing.CurrentTarget == static_cast<uint8>(Target); });
		if (!Map)
		{
			Map = &Lod.PointWeightMaps.AddDefaulted_GetRef();
		}
		Map->Values = Values;
		Map->CurrentTarget = static_cast<uint8>(Target);
		Map->bEnabled = true;
		Map->Name = FName(*StaticEnum<EWeightMapTargetCommon>()->GetNameStringByValue(static_cast<int64>(Target)));
	}

	TSharedRef<FJsonObject> BuildSection(USkeletalMesh* Mesh, const TSharedPtr<FJsonObject>& Section)
	{
		TSharedRef<FJsonObject> Report = MakeShared<FJsonObject>();
		const FString MaterialName = Section->GetStringField(TEXT("material"));
		Report->SetStringField(TEXT("material"), MaterialName);
		FSkeletalMeshLODModel& Lod = Mesh->GetImportedModel()->LODModels[0];
		const int32 SectionIndex = FindSection(Mesh, Lod, MaterialName);
		if (SectionIndex == INDEX_NONE)
		{
			Report->SetStringField(TEXT("error"), FString::Printf(TEXT("no section of %s uses material %s"), *Mesh->GetName(), *MaterialName));
			return Report;
		}
		const UMaterialInterface* SectionMaterial = Mesh->GetMaterials()[Lod.Sections[SectionIndex].MaterialIndex].MaterialInterface;
		const UMaterial* BaseMaterial = SectionMaterial ? SectionMaterial->GetMaterial() : nullptr;
		if (!BaseMaterial || !BaseMaterial->GetUsageByFlag(MATUSAGE_Clothing))
		{
			Report->SetStringField(TEXT("error"), FString::Printf(TEXT("material %s of section %s has no Clothing usage: the game would draw the cloth with the default material"), BaseMaterial ? *BaseMaterial->GetPathName() : TEXT("(none)"), *MaterialName));
			return Report;
		}
		FPinRule Pin;
		FString PinError;
		if (!ReadPin(Section, Pin, PinError))
		{
			Report->SetStringField(TEXT("error"), PinError);
			return Report;
		}

		FSkeletalMeshClothBuildParams Params;
		Params.AssetName = FString::Printf(TEXT("Cloth_%s"), *MaterialName);
		Params.LodIndex = 0;
		Params.SourceSection = SectionIndex;
		Params.bRemoveFromMesh = false;
		bool bCollideWithOwnBodies = false;
		Section->TryGetBoolField(TEXT("collideWithOwnBodies"), bCollideWithOwnBodies);
		Params.PhysicsAsset = bCollideWithOwnBodies ? Mesh->GetPhysicsAsset() : nullptr;
		UClothingAssetFactory* Factory = GetMutableDefault<UClothingAssetFactory>();
		UClothingAssetCommon* Asset = Cast<UClothingAssetCommon>(Factory->CreateFromSkeletalMesh(Mesh, Params));
		if (!Asset)
		{
			Report->SetStringField(TEXT("error"), FString::Printf(TEXT("the clothing factory made nothing from section %d"), SectionIndex));
			return Report;
		}
		Mesh->AddClothingAsset(Asset);

		const FClothPhysicalMeshData& Physical = Asset->LodData[0].PhysicalMeshData;
		SetWeightMap(Asset, EWeightMapTargetCommon::MaxDistance, Freedom(Physical, Pin, Section->GetNumberField(TEXT("maxDistance"))));
		double AnimDrive = 0;
		if (Section->TryGetNumberField(TEXT("animDrive"), AnimDrive))
		{
			SetWeightMap(Asset, EWeightMapTargetCommon::AnimDriveStiffness, Freedom(Physical, Pin, AnimDrive));
		}
		Asset->ApplyParameterMasks(true);

		const TSharedPtr<FJsonObject>* Config = nullptr;
		UChaosClothConfig* ChaosConfig = Asset->GetClothConfig<UChaosClothConfig>();
		if (ChaosConfig && Section->TryGetObjectField(TEXT("config"), Config))
		{
			for (const TPair<FString, TSharedPtr<FJsonValue>>& Entry : (*Config)->Values)
			{
				if (!FindFProperty<FProperty>(UChaosClothConfig::StaticClass(), *Entry.Key))
				{
					Report->SetStringField(TEXT("error"), FString::Printf(TEXT("config: UChaosClothConfig has no property %s"), *Entry.Key));
					return Report;
				}
			}
			FText Failure;
			if (!FJsonObjectConverter::JsonObjectToUStruct((*Config).ToSharedRef(), ChaosConfig, 0, 0, false, &Failure))
			{
				Report->SetStringField(TEXT("error"), FString::Printf(TEXT("config: %s"), *Failure.ToString()));
				return Report;
			}
		}

		FString Error;
		if (!FSkeletalMeshClothingSystemUtilities::AssignClothingToSection(Mesh, Asset, 0, SectionIndex, 0, &Error))
		{
			Report->SetStringField(TEXT("error"), Error);
			return Report;
		}
		Asset->InvalidateAllCachedData();

		int32 Pinned = 0;
		for (const float Value : Freedom(Physical, Pin, 1.f))
		{
			Pinned += Value <= 0.f ? 1 : 0;
		}
		Report->SetStringField(TEXT("asset"), Asset->GetName());
		Report->SetNumberField(TEXT("section"), SectionIndex);
		Report->SetNumberField(TEXT("particles"), Physical.Vertices.Num());
		Report->SetNumberField(TEXT("pinned"), Pinned);
		FBox3f Extent(ForceInit);
		for (const FVector3f& Vertex : Physical.Vertices)
		{
			Extent += Vertex;
		}
		Report->SetStringField(TEXT("vertexBounds"), FString::Printf(TEXT("min %s max %s"), *Extent.Min.ToString(), *Extent.Max.ToString()));
		Report->SetBoolField(TEXT("chaosConfig"), ChaosConfig != nullptr);
		UE_LOGF(LogVgeCloth, Display, "Cloth %ls on %ls section %d: %d particles, %d pinned", *Asset->GetName(), *Mesh->GetName(), SectionIndex, Physical.Vertices.Num(), Pinned);
		return Report;
	}
}

TSharedRef<FJsonObject> VgeCloth::Build(USkeletalMesh* Mesh, const TSharedPtr<FJsonObject>& Description)
{
	TSharedRef<FJsonObject> Report = MakeShared<FJsonObject>();
	Report->SetStringField(TEXT("mesh"), Mesh->GetPathName());
	TArray<TSharedPtr<FJsonValue>> Sections;
	const TArray<TSharedPtr<FJsonValue>>* Requested = nullptr;
	if (!Description->TryGetArrayField(TEXT("sections"), Requested))
	{
		Report->SetStringField(TEXT("error"), TEXT("a cloth description lists its sections"));
		return Report;
	}
	Mesh->Modify();
	for (const TSharedPtr<FJsonValue>& Value : *Requested)
	{
		Sections.Add(MakeShared<FJsonValueObject>(BuildSection(Mesh, Value->AsObject())));
	}
	Mesh->PostEditChange();
	Report->SetArrayField(TEXT("sections"), Sections);
	return Report;
}
