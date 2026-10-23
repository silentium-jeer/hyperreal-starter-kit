#pragma once

#include "Commandlets/Commandlet.h"
#include "VgeImportCommandlet.generated.h"

// Imports one source file (glTF/FBX/...) through Interchange into a content path, enables Nanite on
// every static mesh it produced, saves the packages and writes a JSON report of what was created:
//   UnrealEditor-Cmd.exe VibeGameEngine.uproject -run=VgeImport -Source=<file> -Dest=/VgeLive/Name_v3 -Report=<json>
UCLASS()
class UVgeImportCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	virtual int32 Main(const FString& Params) override;
};
