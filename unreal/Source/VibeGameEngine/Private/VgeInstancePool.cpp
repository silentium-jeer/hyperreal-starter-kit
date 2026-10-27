#include "VgeInstancePool.h"

#include "Components/InstancedStaticMeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Engine/World.h"
#include "GameFramework/Actor.h"

FVgeInstance UVgeInstancePool::AddInstance(UStaticMeshComponent* Template, const FTransform& Transform)
{
	FVgeInstance Instance;
	UWorld* World = GetWorld();
	if (!Template || !Template->GetStaticMesh() || !World)
	{
		return Instance;
	}

	// The cluster key PackedLevelActorISMBuilder uses. The component is an ISM for every mesh, Nanite or not:
	// the stable-id API (AddInstanceById, AddInstanceInternal underneath) skips HISM's own bookkeeping
	// (InstanceReorderTable, InstanceCountToRender, kept only by UHierarchicalInstancedStaticMeshComponent::
	// AddInstance), so an HISM filled by id renders nothing. ISM instances are culled on the GPU (GPU Scene).
	FISMComponentDescriptor Descriptor;
	Descriptor.InitFrom(Template, /*bInitBodyInstance*/ false);
	Descriptor.BodyInstance.CopyRuntimeBodyInstancePropertiesFrom(&Template->BodyInstance);
	Descriptor.ComponentClass = UInstancedStaticMeshComponent::StaticClass();
	Descriptor.ComputeHash();

	int32 Group = INDEX_NONE;
	for (const int32 Candidate : GroupsByHash.FindOrAdd(Descriptor.Hash))
	{
		if (Groups[Candidate].Descriptor == Descriptor && Groups[Candidate].Component.IsValid())
		{
			Group = Candidate;
			break;
		}
	}
	if (Group == INDEX_NONE)
	{
		if (!Owner)
		{
			FActorSpawnParameters Parameters;
			Parameters.Name = TEXT("VgeInstancePool");
			Parameters.NameMode = FActorSpawnParameters::ESpawnActorNameMode::Requested;
			Owner = World->SpawnActor<AActor>(AActor::StaticClass(), FTransform::Identity, Parameters);
			Owner->SetRootComponent(NewObject<USceneComponent>(Owner, TEXT("Root")));
			Owner->GetRootComponent()->RegisterComponent();
		}
		UInstancedStaticMeshComponent* Component = Descriptor.CreateComponent(Owner);
		Component->AttachToComponent(Owner->GetRootComponent(), FAttachmentTransformRules::SnapToTargetIncludingScale);
		Component->RegisterComponent();
		Group = Groups.Add({ Descriptor, Component });
		GroupsByHash.FindOrAdd(Descriptor.Hash).Add(Group);
	}

	Instance.Group = Group;
	Instance.Id = GroupComponent(Group)->AddInstanceById(Transform, /*bWorldSpace*/ true).GetAsIndex();
	return Instance;
}

namespace
{
	FPrimitiveInstanceId InstanceId(const FVgeInstance& Instance)
	{
		FPrimitiveInstanceId Id;
		Id.Id = Instance.Id;
		return Id;
	}
}

void UVgeInstancePool::UpdateInstance(const FVgeInstance& Instance, const FTransform& Transform)
{
	if (UInstancedStaticMeshComponent* Component = GroupComponent(Instance.Group))
	{
		const FPrimitiveInstanceId Id = InstanceId(Instance);
		if (Component->IsValidId(Id))
		{
			Component->UpdateInstanceTransformById(Id, Transform, /*bWorldSpace*/ true, /*bTeleport*/ true);
		}
	}
}

void UVgeInstancePool::RemoveInstance(const FVgeInstance& Instance)
{
	if (UInstancedStaticMeshComponent* Component = GroupComponent(Instance.Group))
	{
		const FPrimitiveInstanceId Id = InstanceId(Instance);
		if (Component->IsValidId(Id))
		{
			Component->RemoveInstanceById(Id);
		}
		// An empty group goes with its last instance; the descriptor gets a new component if it comes back.
		if (Component->GetInstanceCount() == 0)
		{
			Component->DestroyComponent();
			Groups[Instance.Group].Component = nullptr;
		}
	}
}

int32 UVgeInstancePool::NumGroups() const
{
	int32 Count = 0;
	for (const FGroup& Group : Groups)
	{
		Count += Group.Component.IsValid() ? 1 : 0;
	}
	return Count;
}

int32 UVgeInstancePool::NumInstances() const
{
	int32 Count = 0;
	for (const FGroup& Group : Groups)
	{
		Count += Group.Component.IsValid() ? Group.Component->GetInstanceCount() : 0;
	}
	return Count;
}

void UVgeInstancePool::Deinitialize()
{
	if (Owner)
	{
		Owner->Destroy();
		Owner = nullptr;
	}
	Groups.Reset();
	GroupsByHash.Reset();
	Super::Deinitialize();
}

UInstancedStaticMeshComponent* UVgeInstancePool::GroupComponent(int32 Group) const
{
	return Groups.IsValidIndex(Group) ? Groups[Group].Component.Get() : nullptr;
}
