#pragma once

#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "VgeGameMode.generated.h"

// Spawns a player controller and no pawn: everything in the world is created by TypeScript.
UCLASS()
class VIBEGAMEENGINE_API AVgeGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AVgeGameMode();
};
