#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

// Niagara systems described in TypeScript (vge/content/niagara.mjs), built in the content service through the
// engine's own Niagara tool calls (the NiagaraToolsets plugin's toolsets in the ToolsetRegistry: CreateNiagaraSystem,
// AddEmitter, AddModule, AddRenderer, SetStackInputData, SetEmitterData, SetRendererData, AddUserVariables...). They
// take and return JSON, so a system is a list of calls.
namespace VgeNiagara
{
	// { calls: [{ tool: "NiagaraToolset_System.AddEmitter", input: {...} }] }: runs them in order and returns
	// { results: [...] }, each the tool's JSON result; the first failing call ends it with { error, failedCall }.
	TSharedRef<FJsonObject> RunTools(const TSharedPtr<FJsonObject>& Request);

	// { schemas }: the JSON schemas of every registered tool, to write calls against.
	TSharedRef<FJsonObject> Schemas();

	// { path }: compiles the system (waiting for it) and saves its package; { compiled, saved }.
	TSharedRef<FJsonObject> Save(const TSharedPtr<FJsonObject>& Request);

	TSharedRef<FJsonObject> SetConstants(const TSharedPtr<FJsonObject>& Request);
}
