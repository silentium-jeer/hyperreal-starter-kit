#pragma once

#include "CoreMinimal.h"
#include "ISMPartition/ISMComponentDescriptor.h"
#include "Subsystems/WorldSubsystem.h"
#include "VgeInstancePool.generated.h"

class UInstancedStaticMeshComponent;
class UStaticMeshComponent;

// One instance of a packed static mesh: the group (one instanced component per descriptor) and its stable id.
USTRUCT(BlueprintType)
struct FVgeInstance
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "Vge")
	int32 Group = INDEX_NONE;

	UPROPERTY(BlueprintReadOnly, Category = "Vge")
	int32 Id = INDEX_NONE;
};

// Static meshes of the scene renderer packed the way a Packed Level Actor packs them (PackedLevelActorISMBuilder):
// components that would render identically share one instanced component, keyed by FISMComponentDescriptor
// (mesh, materials, collision, shadows, visibility), always an ISM (see AddInstance). Instances are addressed by
// FPrimitiveInstanceId, which stays valid while other instances come and go.
UCLASS()
class VIBEGAMEENGINE_API UVgeInstancePool : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	// Adds an instance that renders like Template (an unregistered component holding the mesh, materials and
	// collision settings) at a world transform.
	UFUNCTION(BlueprintCallable, Category = "Vge")
	FVgeInstance AddInstance(UStaticMeshComponent* Template, const FTransform& Transform);

	UFUNCTION(BlueprintCallable, Category = "Vge")
	void UpdateInstance(const FVgeInstance& Instance, const FTransform& Transform);

	UFUNCTION(BlueprintCallable, Category = "Vge")
	void RemoveInstance(const FVgeInstance& Instance);

	// Instanced components in use and instances across them.
	UFUNCTION(BlueprintCallable, Category = "Vge")
	int32 NumGroups() const;

	UFUNCTION(BlueprintCallable, Category = "Vge")
	int32 NumInstances() const;

	virtual void Deinitialize() override;

private:
	struct FGroup
	{
		FISMComponentDescriptor Descriptor;
		TWeakObjectPtr<UInstancedStaticMeshComponent> Component;
	};

	UInstancedStaticMeshComponent* GroupComponent(int32 Group) const;

	TArray<FGroup> Groups;
	TMap<uint32, TArray<int32>> GroupsByHash;

	UPROPERTY(Transient)
	TObjectPtr<AActor> Owner;
};
