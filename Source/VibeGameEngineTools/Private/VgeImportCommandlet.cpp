#include "VgeImportCommandlet.h"

#include "Misc/FileHelper.h"
#include "Misc/Parse.h"
#include "VgeImporter.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"

int32 UVgeImportCommandlet::Main(const FString& Params)
{
	FString Source, Dest, ReportPath;
	if (!FParse::Value(*Params, TEXT("Source="), Source) || !FParse::Value(*Params, TEXT("Dest="), Dest) || !FParse::Value(*Params, TEXT("Report="), ReportPath))
	{
		UE_LOGF(LogTemp, Error, "Usage: -run=VgeImport -Source=<file> -Dest=/Mount/Path -Report=<json file>");
		return 1;
	}

	const TSharedRef<FJsonObject> Report = VgeImporter::Import(Source, Dest);
	FString Json;
	FJsonSerializer::Serialize(Report, TJsonWriterFactory<>::Create(&Json));
	FFileHelper::SaveStringToFile(Json, *ReportPath, FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
	return Report->GetBoolField(TEXT("saved")) ? 0 : 1;
}
