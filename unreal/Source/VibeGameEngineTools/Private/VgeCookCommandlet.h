#pragma once

#include "Commandlets/Commandlet.h"
#include "VgeCookCommandlet.generated.h"

// A stock cook started ahead of time. The engine starts (the slow part), then waits for one line on
// stdin before running the regular CookCommandlet with this process's own arguments, so the content
// pipeline always has a warmed-up cooker ready while each cook still gets a fresh process, as the
// editor does since 5.7. Started with -RunAsCookCommandlet so the engine initializes as the cooker:
//   UnrealEditor-Cmd.exe VibeGameEngine.uproject -run=VgeCook -RunAsCookCommandlet -TargetPlatform=Windows -dlcname=VgeLive ...
// stdout: "@@vge {"event":"standby"}" when waiting, "@@vge {"event":"done","code":0}" after the cook.
UCLASS()
class UVgeCookCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	virtual int32 Main(const FString& Params) override;
};
