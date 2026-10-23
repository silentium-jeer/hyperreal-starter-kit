#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "VgeScriptLibrary.generated.h"

class UActorComponent;

// Engine calls the scene renderer needs and Unreal does not expose as UFunctions.
UCLASS()
class VIBEGAMEENGINE_API UVgeScriptLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	// After properties of a registered component were written directly (no setter), recreates its render and
	// physics state from them, as an edit in the editor does. An actor's native components are registered as
	// soon as it is spawned, deferred or not (AActor::PostSpawnInitialize), so this is how they see such writes.
	UFUNCTION(BlueprintCallable, Category = "Vge")
	static void ReregisterComponent(UActorComponent* Component);
};
