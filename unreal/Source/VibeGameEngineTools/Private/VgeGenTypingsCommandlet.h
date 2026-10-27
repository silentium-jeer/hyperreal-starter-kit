#pragma once

#include "Commandlets/Commandlet.h"
#include "VgeGenTypingsCommandlet.generated.h"

// Writes Typing/ue/ue.d.ts (all reflected engine and project types) without opening the editor:
//   UnrealEditor-Cmd.exe VibeGameEngine.uproject -run=VgeGenTypings
UCLASS()
class UVgeGenTypingsCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	virtual int32 Main(const FString& Params) override;
};
