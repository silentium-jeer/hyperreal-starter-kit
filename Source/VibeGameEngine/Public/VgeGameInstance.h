#pragma once

#include "Containers/Ticker.h"
#include "CoreMinimal.h"
#include "Engine/GameInstance.h"
#include "PuertsNamespaceDef.h"
#include "VgeGameInstance.generated.h"

namespace PUERTS_NAMESPACE
{
class FJsEnv;
}

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FVgeTick, float, DeltaSeconds);

// Starts the game without loading any map package and hands control to TypeScript.
UCLASS()
class VIBEGAMEENGINE_API UVgeGameInstance : public UGameInstance
{
	GENERATED_BODY()

public:
	// WebSocket URL of the Vite dev server, from -DevServer=ws://host:port/path on the command line.
	UPROPERTY(BlueprintReadOnly, Category = "Vge")
	FString DevServerUrl;

	// Entry module the bootstrap asks the dev server for, from -Entry=/src/main.ts.
	UPROPERTY(BlueprintReadOnly, Category = "Vge")
	FString EntryModule;

	// HTML/CSS overlay UI; script code calls UI.Show(url) to put a page on screen.
	UPROPERTY(BlueprintReadOnly, Category = "Vge")
	TObjectPtr<class UVgeUI> UI;

	// Broadcast once per engine frame, before the world ticks, so script input and gameplay run every
	// frame like engine systems do (timers fire on wall-clock intervals and skip frames).
	UPROPERTY(BlueprintAssignable, Category = "Vge")
	FVgeTick OnTick;

	virtual void StartGameInstance() override;
	virtual void Shutdown() override;

	// Seconds since process start, for timing measurements made from script.
	UFUNCTION(BlueprintCallable, Category = "Vge")
	double SecondsSinceProcessStart() const;

	// Mounts a cooked content container (.pak with its .utoc/.ucas) produced by the content service
	// and opens the shader library of the plugin it belongs to, or the container's own ShaderLibrary when it names
	// one (an asset pack's container: its library is named after the pack, dev/content/pipeline.mjs buildPack).
	// New packages in it load right after.
	UFUNCTION(BlueprintCallable, Category = "Vge")
	bool MountContent(const FString& PakPath, const FString& PluginName, const FString& ShaderLibrary);

private:
	void EnterCodeBuiltWorld();

	TSharedPtr<PUERTS_NAMESPACE::FJsEnv> JsEnv;
	FTSTicker::FDelegateHandle TickHandle;
};
