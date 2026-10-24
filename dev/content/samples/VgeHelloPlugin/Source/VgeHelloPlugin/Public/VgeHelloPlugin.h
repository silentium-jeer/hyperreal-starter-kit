#pragma once

#include "Kismet/BlueprintFunctionLibrary.h"
#include "VgeHelloPlugin.generated.h"

// What the sample plugin gives the game: one call that proves its code is linked in and reachable from TypeScript
// (UE.VgeHelloPlugin.Hello / .Add through Puerts).
UCLASS()
class VGEHELLOPLUGIN_API UVgeHelloPlugin : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	// "Hello, <Name>, from VgeHelloPlugin 1.0".
	UFUNCTION(BlueprintCallable, Category = "Vge|Hello")
	static FString Hello(const FString& Name);

	UFUNCTION(BlueprintCallable, Category = "Vge|Hello")
	static int32 Add(int32 A, int32 B);
};
