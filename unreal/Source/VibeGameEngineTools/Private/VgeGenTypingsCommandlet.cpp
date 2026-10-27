#include "VgeGenTypingsCommandlet.h"

#include "HAL/FileManager.h"
#include "IDeclarationGenerator.h"
#include "Misc/FileHelper.h"
#include "Misc/Paths.h"
#include "Modules/ModuleManager.h"
#include "VgeJsxDeclarations.h"

int32 UVgeGenTypingsCommandlet::Main(const FString& Params)
{
	IDeclarationGenerator& Generator = FModuleManager::LoadModuleChecked<IDeclarationGenerator>(TEXT("DeclarationGenerator"));
	Generator.GenTypeScriptDeclaration(true, NAME_None);

	const FString Output = FPaths::ConvertRelativePathToFull(FPaths::ProjectDir() / TEXT("Typing/ue/ue.d.ts"));
	const int64 Size = IFileManager::Get().FileSize(*Output);
	if (Size <= 0)
	{
		UE_LOGF(LogTemp, Error, "VgeGenTypings: %ls was not written", *Output);
		return 1;
	}
	UE_LOGF(LogTemp, Display, "VgeGenTypings: wrote %ls (%lld bytes)", *Output, Size);
	return VgeJsxDeclarations::Write(FPaths::GetPath(Output)) ? 0 : 1;
}
