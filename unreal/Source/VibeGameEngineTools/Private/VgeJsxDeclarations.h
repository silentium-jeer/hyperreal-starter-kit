#pragma once

#include "CoreMinimal.h"

// Writes the JSX surface of the engine for the React scene renderer (src/shared/react), from reflection:
//   Typing/ue/ue-jsx.d.ts - one element per native, non-abstract actor and actor component class (camelCase
//                           class name, in UeIntrinsicElements), its props are the properties Unreal exposes for
//                           editing (EditAnywhere / BlueprintReadWrite), Blueprint setters without a property of
//                           their own, and BlueprintAssignable events;
//   Typing/ue/ue-jsx.json - what the renderer needs at runtime for the same classes: the parent class, and per
//                           prop the property name, the kind of value and the setter Sequencer would call
//                           (FTrackInstancePropertyBindings: "Set" + name, a bool without its "b").
namespace VgeJsxDeclarations
{
	// Returns false when a file could not be written.
	bool Write(const FString& TypingDir);
}
