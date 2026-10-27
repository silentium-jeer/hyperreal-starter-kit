#include "VgeScriptLibrary.h"

#include "Components/ActorComponent.h"
#include "Components/SkeletalMeshComponent.h"
#include "ClothingSystemRuntimeTypes.h"
#include "Rendering/SkeletalMeshRenderData.h"
#include "SkeletalRenderPublic.h"

TArray<FVector> UVgeScriptLibrary::ClothParticles(USkeletalMeshComponent* Component)
{
	TArray<FVector> World;
	if (!Component)
	{
		return World;
	}
	for (const TPair<int32, FClothSimulData>& Entry : Component->GetCurrentClothingData_GameThread())
	{
		for (const FVector3f& Position : Entry.Value.Positions)
		{
			World.Add(Entry.Value.Transform.TransformPosition(FVector(Position)));
		}
	}
	return World;
}

TArray<FVector> UVgeScriptLibrary::ClothNormals(USkeletalMeshComponent* Component)
{
	TArray<FVector> World;
	if (!Component)
	{
		return World;
	}
	for (const TPair<int32, FClothSimulData>& Entry : Component->GetCurrentClothingData_GameThread())
	{
		for (const FVector3f& Normal : Entry.Value.Normals)
		{
			World.Add(Entry.Value.Transform.TransformVectorNoScale(FVector(Normal)));
		}
	}
	return World;
}

TArray<FVector> UVgeScriptLibrary::RenderedVertices(USkeletalMeshComponent* Component, int32 Section)
{
	TArray<FVector> World;
	const FSkeletalMeshRenderData* RenderData = Component ? Component->GetSkeletalMeshRenderData() : nullptr;
	if (!RenderData || RenderData->LODRenderData.Num() == 0 || !RenderData->LODRenderData[0].RenderSections.IsValidIndex(Section))
	{
		return World;
	}
	TArray<FFinalSkinVertex> Vertices;
	Component->GetCPUSkinnedVertices(Vertices, 0);
	const FSkelMeshRenderSection& Rendered = RenderData->LODRenderData[0].RenderSections[Section];
	const FTransform ComponentToWorld = Component->GetComponentTransform();
	for (uint32 Index = Rendered.BaseVertexIndex; Index < Rendered.BaseVertexIndex + Rendered.NumVertices && Index < static_cast<uint32>(Vertices.Num()); ++Index)
	{
		World.Add(ComponentToWorld.TransformPosition(FVector(Vertices[Index].Position)));
	}
	return World;
}

void UVgeScriptLibrary::ReregisterComponent(UActorComponent* Component)
{
	if (Component && Component->IsRegistered())
	{
		Component->ReregisterComponent();
	}
}
