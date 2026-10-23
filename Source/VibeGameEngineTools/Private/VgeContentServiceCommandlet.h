#pragma once

#include "Commandlets/Commandlet.h"
#include "VgeContentServiceCommandlet.generated.h"

// Resident content service owned by the Vite dev server. It keeps the editor-side engine (asset registry,
// Interchange, DDC, shader compilers) warm and executes requests read as JSON lines on stdin:
//   {"id":1,"cmd":"import","source":"C:/x.glb","dest":"/VgeLive/Name_b0003"}
//   {"id":2,"cmd":"delete","path":"/VgeLive/Name_b0002"}
//   {"id":3,"cmd":"ping"}
// Every reply is one stdout line "@@vge {json}" ({"id":1,"ok":true,"result":{...},"seconds":1.2});
// "@@vge {"event":"ready"}" announces that requests are accepted. Closing stdin ends the service.
//   UnrealEditor-Cmd.exe VibeGameEngine.uproject -run=VgeContentService
UCLASS()
class UVgeContentServiceCommandlet : public UCommandlet
{
	GENERATED_BODY()

public:
	virtual int32 Main(const FString& Params) override;
};
