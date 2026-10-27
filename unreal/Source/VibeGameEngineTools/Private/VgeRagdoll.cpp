#include "VgeRagdoll.h"

#include "Engine/SkeletalMesh.h"
#include "PhysicsAssetUtils.h"
#include "PhysicsEngine/BodySetup.h"
#include "PhysicsEngine/PhysicsAsset.h"
#include "PhysicsEngine/PhysicsConstraintTemplate.h"
#include "PhysicsEngine/SkeletalBodySetup.h"
#include "ReferenceSkeleton.h"

DEFINE_LOG_CATEGORY_STATIC(LogVgeRagdoll, Log, All);

namespace
{
	enum class ERole
	{
		Pelvis,
		Spine,
		Neck,
		Head,
		Clavicle,
		UpperArm,
		Forearm,
		Hand,
		Thigh,
		Calf,
		Foot,
		Other,
	};

	const TCHAR* RoleName(ERole Role)
	{
		static const TCHAR* Names[] = { TEXT("pelvis"), TEXT("spine"), TEXT("neck"), TEXT("head"), TEXT("clavicle"), TEXT("upperArm"), TEXT("forearm"), TEXT("hand"), TEXT("thigh"), TEXT("calf"), TEXT("foot"), TEXT("other") };
		return Names[static_cast<int32>(Role)];
	}

	// "mixamorig:LeftForeArm", "lowerarm_l", "Bip01 L Forearm" -> Forearm.
	ERole RoleOf(FName Bone)
	{
		FString Name = Bone.ToString().ToLower();
		int32 Colon;
		if (Name.FindLastChar(TEXT(':'), Colon))
		{
			Name = Name.Mid(Colon + 1);
		}
		auto Has = [&Name](const TCHAR* Part) { return Name.Contains(Part); };
		if (Has(TEXT("hips")) || Has(TEXT("pelvis")))
		{
			return ERole::Pelvis;
		}
		if (Has(TEXT("spine")) || Has(TEXT("chest")))
		{
			return ERole::Spine;
		}
		if (Has(TEXT("neck")))
		{
			return ERole::Neck;
		}
		if (Has(TEXT("head")))
		{
			return ERole::Head;
		}
		if (Has(TEXT("clavicle")) || Has(TEXT("shoulder")))
		{
			return ERole::Clavicle;
		}
		if (Has(TEXT("forearm")) || Has(TEXT("lowerarm")))
		{
			return ERole::Forearm;
		}
		if (Has(TEXT("hand")) || Has(TEXT("wrist")))
		{
			return ERole::Hand;
		}
		if (Has(TEXT("upperarm")) || Has(TEXT("arm")))
		{
			return ERole::UpperArm;
		}
		if (Has(TEXT("upleg")) || Has(TEXT("thigh")))
		{
			return ERole::Thigh;
		}
		if (Has(TEXT("calf")) || Has(TEXT("leg")) || Has(TEXT("knee")))
		{
			return ERole::Calf;
		}
		if (Has(TEXT("foot")) || Has(TEXT("toe")) || Has(TEXT("ball")) || Has(TEXT("ankle")))
		{
			return ERole::Foot;
		}
		return ERole::Other;
	}

	// Share of the body's mass per segment (adult anthropometric tables, as game-jam-test's measured ragdolls used); a
	// role with several bodies (the spine) splits its share between them.
	float MassShare(ERole Role)
	{
		switch (Role)
		{
		case ERole::Pelvis: return 0.145f;
		case ERole::Spine: return 0.24f;
		case ERole::Neck: return 0.02f;
		case ERole::Head: return 0.07f;
		case ERole::Clavicle: return 0.01f;
		case ERole::UpperArm: return 0.028f;
		case ERole::Forearm: return 0.016f;
		case ERole::Hand: return 0.006f;
		case ERole::Thigh: return 0.10f;
		case ERole::Calf: return 0.0465f;
		case ERole::Foot: return 0.0145f;
		default: return 0.005f;
		}
	}

	// Hard angular limits in degrees (swing1, swing2, twist) of the joint whose child body has this role.
	FVector3f Limits(ERole Role)
	{
		switch (Role)
		{
		case ERole::Spine: return { 12.f, 12.f, 10.f };
		case ERole::Neck: return { 20.f, 20.f, 20.f };
		case ERole::Head: return { 25.f, 25.f, 30.f };
		case ERole::Clavicle: return { 10.f, 10.f, 5.f };
		case ERole::UpperArm: return { 70.f, 70.f, 40.f };
		case ERole::Forearm: return { 65.f, 65.f, 10.f };
		case ERole::Hand: return { 35.f, 35.f, 15.f };
		case ERole::Thigh: return { 50.f, 50.f, 15.f };
		case ERole::Calf: return { 60.f, 60.f, 5.f };
		case ERole::Foot: return { 25.f, 25.f, 5.f };
		default: return { 20.f, 20.f, 10.f };
		}
	}

	constexpr float TotalMassKg = 75.f;
}

TSharedRef<FJsonObject> VgeRagdoll::Build(USkeletalMesh* Mesh)
{
	TSharedRef<FJsonObject> Result = MakeShared<FJsonObject>();
	UPhysicsAsset* PhysicsAsset = Mesh ? Mesh->GetPhysicsAsset() : nullptr;
	if (!PhysicsAsset)
	{
		Result->SetStringField(TEXT("error"), FString::Printf(TEXT("%s has no physics asset to build"), Mesh ? *Mesh->GetPathName() : TEXT("no mesh")));
		return Result;
	}

	FPhysAssetCreateParams Params;
	// A forearm or a spine segment measures 8-30 cm on an adult rig; fingers and toes (2-4 cm) still merge into the hand
	// and the foot.
	Params.MinBoneSize = 8.f;
	Params.GeomType = EFG_Sphyl;
	Params.VertWeight = EVW_DominantWeight;
	Params.bCreateConstraints = true;
	// Constraints disable collision between the two bodies they join; every other pair collides.
	Params.bDisableCollisionsByDefault = false;
	Params.AngularConstraintMode = ACM_Limited;

	PhysicsAsset->Modify();
	PhysicsAsset->SkeletalBodySetups.Empty();
	PhysicsAsset->ConstraintSetup.Empty();
	// The bone-to-body map is what FindBodyIndex reads while bodies are created: left as it was, it points into the
	// emptied array.
	PhysicsAsset->UpdateBodySetupIndexMap();
	FText Error;
	if (!FPhysicsAssetUtils::CreateFromSkeletalMesh(PhysicsAsset, Mesh, Params, Error, /*bSetToMesh*/ true, /*bShowProgress*/ false))
	{
		Result->SetStringField(TEXT("error"), Error.ToString());
		return Result;
	}

	// Fingers are long enough together to get bodies of their own; a ragdoll's hand is one body and the fingers follow
	// it, as on the engine's own mannequin.
	for (int32 Index = PhysicsAsset->SkeletalBodySetups.Num() - 1; Index >= 0; --Index)
	{
		const FString Bone = PhysicsAsset->SkeletalBodySetups[Index]->BoneName.ToString().ToLower();
		if (Bone.Contains(TEXT("thumb")) || Bone.Contains(TEXT("index")) || Bone.Contains(TEXT("middle")) || Bone.Contains(TEXT("ring")) || Bone.Contains(TEXT("pinky")) || Bone.Contains(TEXT("finger")))
		{
			FPhysicsAssetUtils::DestroyBody(PhysicsAsset, Index);
		}
	}

	TMap<ERole, int32> Count;
	for (const TObjectPtr<USkeletalBodySetup>& Body : PhysicsAsset->SkeletalBodySetups)
	{
		Count.FindOrAdd(RoleOf(Body->BoneName))++;
	}
	TArray<TSharedPtr<FJsonValue>> Bodies;
	for (const TObjectPtr<USkeletalBodySetup>& Body : PhysicsAsset->SkeletalBodySetups)
	{
		const ERole Role = RoleOf(Body->BoneName);
		// Left and right share a role's share each: arms and legs are listed per side.
		const bool bPaired = Role == ERole::Clavicle || Role == ERole::UpperArm || Role == ERole::Forearm || Role == ERole::Hand || Role == ERole::Thigh || Role == ERole::Calf || Role == ERole::Foot;
		const float Share = bPaired ? MassShare(Role) : MassShare(Role) / FMath::Max(1, Count[Role]);
		const float Mass = TotalMassKg * Share;
		Body->DefaultInstance.SetMassOverride(Mass, true);
		TSharedRef<FJsonObject> Entry = MakeShared<FJsonObject>();
		Entry->SetStringField(TEXT("bone"), Body->BoneName.ToString());
		Entry->SetStringField(TEXT("role"), RoleName(Role));
		Entry->SetNumberField(TEXT("mass"), Mass);
		Bodies.Add(MakeShared<FJsonValueObject>(Entry));
	}

	for (const TObjectPtr<UPhysicsConstraintTemplate>& Constraint : PhysicsAsset->ConstraintSetup)
	{
		FConstraintInstance& Instance = Constraint->DefaultInstance;
		const FVector3f Limit = Limits(RoleOf(Instance.ConstraintBone1));
		Instance.SetAngularSwing1Limit(ACM_Limited, Limit.X);
		Instance.SetAngularSwing2Limit(ACM_Limited, Limit.Y);
		Instance.SetAngularTwistLimit(ACM_Limited, Limit.Z);
		Instance.SetSoftSwingLimitParams(false, 0.f, 0.f, 0.f, 0.f);
		Instance.SetSoftTwistLimitParams(false, 0.f, 0.f, 0.f, 0.f);
	}

	PhysicsAsset->UpdateBodySetupIndexMap();
	PhysicsAsset->UpdateBoundsBodiesArray();
	PhysicsAsset->PostEditChange();
	UE_LOGF(LogVgeRagdoll, Display, "%ls: %d bodies, %d constraints", *PhysicsAsset->GetPathName(), PhysicsAsset->SkeletalBodySetups.Num(), PhysicsAsset->ConstraintSetup.Num());

	Result->SetStringField(TEXT("physicsAsset"), PhysicsAsset->GetPathName());
	Result->SetArrayField(TEXT("bodies"), Bodies);
	Result->SetNumberField(TEXT("constraints"), PhysicsAsset->ConstraintSetup.Num());
	return Result;
}
