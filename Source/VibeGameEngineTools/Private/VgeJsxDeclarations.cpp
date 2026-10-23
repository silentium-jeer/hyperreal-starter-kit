#include "VgeJsxDeclarations.h"

#include "Components/ActorComponent.h"
#include "Components/SceneComponent.h"
#include "Dom/JsonObject.h"
#include "GameFramework/Actor.h"
#include "Misc/FileHelper.h"
#include "Serialization/JsonSerializer.h"
#include "Serialization/JsonWriter.h"
#include "UObject/UObjectIterator.h"

namespace
{
	FString CamelCase(const FString& Name)
	{
		return Name.IsEmpty() ? Name : Name.Left(1).ToLower() + Name.Mid(1);
	}

	// "bHidden" -> "Hidden", the way FTrackInstancePropertyBindings names a bool's setter.
	FString WithoutBoolPrefix(const FProperty* Property)
	{
		const FString Name = Property->GetName();
		return CastField<FBoolProperty>(Property) && Name.Len() > 1 && Name[0] == TEXT('b') && FChar::IsUpper(Name[1]) ? Name.Mid(1) : Name;
	}

	bool IsElementClass(const UClass* Class)
	{
		return Class->HasAnyClassFlags(CLASS_Native) && !Class->HasAnyClassFlags(CLASS_Deprecated | CLASS_NewerVersionExists)
			&& (Class->IsChildOf(AActor::StaticClass()) || Class->IsChildOf(UActorComponent::StaticClass()));
	}

	// Properties Unreal exposes for editing or Blueprint writes, and component pointers (VisibleAnywhere), whose
	// own properties are set through a nested object.
	bool IsComponentPointer(const FProperty* Property)
	{
		const FObjectProperty* Object = CastField<FObjectProperty>(Property);
		return Object && Object->PropertyClass && Object->PropertyClass->IsChildOf(UActorComponent::StaticClass());
	}

	// A scene component's relative transform is the element's location / rotation / scale, set through the
	// transform functions, not three more props.
	bool IsTransform(const FProperty* Property)
	{
		static const TSet<FName> Names = { TEXT("RelativeLocation"), TEXT("RelativeRotation"), TEXT("RelativeScale3D") };
		return Property->GetOwnerClass() == USceneComponent::StaticClass() && Names.Contains(Property->GetFName());
	}

	bool IsProp(const FProperty* Property)
	{
		if (Property->HasAnyPropertyFlags(CPF_Deprecated) || IsTransform(Property))
		{
			return false;
		}
		if (const FMulticastDelegateProperty* Delegate = CastField<FMulticastDelegateProperty>(Property))
		{
			return Property->HasAnyPropertyFlags(CPF_BlueprintAssignable);
		}
		if (IsComponentPointer(Property))
		{
			return Property->HasAnyPropertyFlags(CPF_Edit | CPF_BlueprintVisible);
		}
		const bool bEditable = Property->HasAnyPropertyFlags(CPF_Edit) && !Property->HasAnyPropertyFlags(CPF_EditConst);
		const bool bWritable = Property->HasAnyPropertyFlags(CPF_BlueprintVisible) && !Property->HasAnyPropertyFlags(CPF_BlueprintReadOnly);
		return bEditable || bWritable;
	}

	FString ArrayElement(const FProperty* Inner);

	// The TypeScript type of a value, in the names Puerts gives native types in ue.d.ts; empty when the renderer
	// has no way to write it.
	FString TsType(const FProperty* Property)
	{
		if (CastField<FBoolProperty>(Property))
		{
			return TEXT("boolean");
		}
		if (const FEnumProperty* Enum = CastField<FEnumProperty>(Property))
		{
			return FString::Printf(TEXT("UE.%s"), *Enum->GetEnum()->GetName());
		}
		if (const FByteProperty* Byte = CastField<FByteProperty>(Property); Byte && Byte->Enum)
		{
			return FString::Printf(TEXT("UE.%s"), *Byte->Enum->GetName());
		}
		if (CastField<FNumericProperty>(Property))
		{
			return TEXT("number");
		}
		if (CastField<FStrProperty>(Property) || CastField<FNameProperty>(Property) || CastField<FTextProperty>(Property))
		{
			return TEXT("string");
		}
		if (const FStructProperty* Struct = CastField<FStructProperty>(Property))
		{
			return FString::Printf(TEXT("StructProp<UE.%s>"), *Struct->Struct->GetName());
		}
		if (const FClassProperty* Class = CastField<FClassProperty>(Property))
		{
			return TEXT("UE.Class | string");
		}
		if (const FObjectProperty* Object = CastField<FObjectProperty>(Property))
		{
			return FString::Printf(TEXT("UE.%s | string"), *Object->PropertyClass->GetName());
		}
		if (const FArrayProperty* Array = CastField<FArrayProperty>(Property))
		{
			const FString Inner = TsType(Array->Inner);
			return Inner.IsEmpty() || ArrayElement(Array->Inner).IsEmpty() ? FString() : FString::Printf(TEXT("ReadonlyArray<%s>"), *Inner);
		}
		return FString();
	}

	// The element type of an array prop as the runtime builds it with UE.NewArray: a class, a struct, or one of
	// Puerts' builtin element types.
	FString ArrayElement(const FProperty* Inner)
	{
		if (const FObjectProperty* Object = CastField<FObjectProperty>(Inner))
		{
			return TEXT("object:") + Object->PropertyClass->GetName();
		}
		if (const FStructProperty* Struct = CastField<FStructProperty>(Inner))
		{
			return TEXT("struct:") + Struct->Struct->GetName();
		}
		if (CastField<FBoolProperty>(Inner))
		{
			return TEXT("BuiltinBool");
		}
		if (CastField<FEnumProperty>(Inner) || CastField<FByteProperty>(Inner))
		{
			return TEXT("BuiltinByte");
		}
		if (CastField<FIntProperty>(Inner))
		{
			return TEXT("BuiltinInt");
		}
		if (CastField<FFloatProperty>(Inner))
		{
			return TEXT("BuiltinFloat");
		}
		if (CastField<FDoubleProperty>(Inner))
		{
			return TEXT("BuiltinDouble");
		}
		if (CastField<FStrProperty>(Inner))
		{
			return TEXT("BuiltinString");
		}
		if (CastField<FNameProperty>(Inner))
		{
			return TEXT("BuiltinName");
		}
		return FString();
	}

	FString Kind(const FProperty* Property)
	{
		if (CastField<FMulticastDelegateProperty>(Property))
		{
			return TEXT("event");
		}
		if (IsComponentPointer(Property))
		{
			return TEXT("component");
		}
		if (const FStructProperty* Struct = CastField<FStructProperty>(Property))
		{
			return TEXT("struct:") + Struct->Struct->GetName();
		}
		if (CastField<FClassProperty>(Property) || CastField<FObjectProperty>(Property))
		{
			return TEXT("object");
		}
		if (const FArrayProperty* Array = CastField<FArrayProperty>(Property))
		{
			return TEXT("array:") + ArrayElement(Array->Inner);
		}
		return TEXT("value");
	}

	FString HandlerType(const FMulticastDelegateProperty* Delegate)
	{
		TArray<FString> Parameters;
		if (const UFunction* Signature = Delegate->SignatureFunction)
		{
			for (TFieldIterator<FProperty> It(Signature); It && It->HasAnyPropertyFlags(CPF_Parm) && !It->HasAnyPropertyFlags(CPF_ReturnParm); ++It)
			{
				const FString Type = TsType(*It);
				Parameters.Add(FString::Printf(TEXT("%s: %s"), *CamelCase(It->GetName()), Type.IsEmpty() ? TEXT("unknown") : *Type));
			}
		}
		return FString::Printf(TEXT("(%s) => void"), *FString::Join(Parameters, TEXT(", ")));
	}

	struct FClassOutput
	{
		FString Declaration;
		TSharedPtr<FJsonObject> Runtime;
	};

	FClassOutput DescribeClass(const UClass* Class)
	{
		const UClass* Parent = Class->GetSuperClass();
		const bool bRoot = Class == AActor::StaticClass() || Class == UActorComponent::StaticClass();
		const FString Base = bRoot ? (Class == AActor::StaticClass() ? TEXT("ActorElement") : TEXT("ComponentElement"))
			: FString::Printf(TEXT("%sProps"), *Parent->GetName());

		FString Body;
		TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
		TSet<FString> Seen;
		for (TFieldIterator<FProperty> It(Class, EFieldIteratorFlags::ExcludeSuper); It; ++It)
		{
			const FProperty* Property = *It;
			if (!IsProp(Property))
			{
				continue;
			}
			FString PropName;
			FString Type;
			if (const FMulticastDelegateProperty* Delegate = CastField<FMulticastDelegateProperty>(Property))
			{
				const FString Name = Property->GetName();
				PropName = TEXT("on") + (Name.StartsWith(TEXT("On"), ESearchCase::CaseSensitive) ? Name.Mid(2) : Name);
				Type = HandlerType(Delegate);
			}
			else if (IsComponentPointer(Property))
			{
				PropName = CamelCase(Property->GetName());
				Type = FString::Printf(TEXT("Partial<%sProps>"), *CastField<FObjectProperty>(Property)->PropertyClass->GetName());
			}
			else
			{
				PropName = CamelCase(WithoutBoolPrefix(Property));
				Type = TsType(Property);
			}
			if (Type.IsEmpty() || Seen.Contains(PropName))
			{
				continue;
			}
			Seen.Add(PropName);
			Body += FString::Printf(TEXT("  %s?: %s;\n"), *PropName, *Type);

			TArray<TSharedPtr<FJsonValue>> Entry = { MakeShared<FJsonValueString>(Property->GetName()), MakeShared<FJsonValueString>(Kind(Property)) };
			if (!CastField<FMulticastDelegateProperty>(Property) && !IsComponentPointer(Property))
			{
				// Sequencer's rule for a property set from outside: a UFunction "Set<Name>" with a parameter.
				const UFunction* Setter = Class->FindFunctionByName(FName(TEXT("Set") + WithoutBoolPrefix(Property)));
				if (Setter && Setter->NumParms >= 1)
				{
					Entry.Add(MakeShared<FJsonValueString>(Setter->GetName()));
				}
			}
			Props->SetArrayField(PropName, Entry);
		}

		// Settings that live behind a Blueprint setter with no property of their own (SetSimulatePhysics writes into
		// FBodyInstance): a BlueprintCallable "Set<Name>" taking one value is a write-only prop.
		for (TFieldIterator<UFunction> It(Class, EFieldIteratorFlags::ExcludeSuper); It; ++It)
		{
			const UFunction* Function = *It;
			const FString Name = Function->GetName();
			if (!Function->HasAnyFunctionFlags(FUNC_BlueprintCallable) || !Name.StartsWith(TEXT("Set"), ESearchCase::CaseSensitive) || Name.Len() < 4 || !FChar::IsUpper(Name[3]))
			{
				continue;
			}
			const FProperty* Parameter = nullptr;
			int32 Parameters = 0;
			for (TFieldIterator<FProperty> Param(Function); Param && Param->HasAnyPropertyFlags(CPF_Parm); ++Param)
			{
				if (Param->HasAnyPropertyFlags(CPF_ReturnParm))
				{
					continue;
				}
				Parameter = Param->HasAnyPropertyFlags(CPF_OutParm) && !Param->HasAnyPropertyFlags(CPF_ConstParm) ? nullptr : *Param;
				++Parameters;
			}
			const FString PropName = CamelCase(Name.Mid(3));
			const FString Type = Parameter && Parameters == 1 ? TsType(Parameter) : FString();
			if (Type.IsEmpty() || Seen.Contains(PropName) || Class->FindPropertyByName(FName(Name.Mid(3))) || Class->FindPropertyByName(FName(TEXT("b") + Name.Mid(3))))
			{
				continue;
			}
			Seen.Add(PropName);
			Body += FString::Printf(TEXT("  %s?: %s;\n"), *PropName, *Type);
			Props->SetArrayField(PropName, { MakeShared<FJsonValueString>(Name), MakeShared<FJsonValueString>(TEXT("call:") + Kind(Parameter)), MakeShared<FJsonValueString>(Name) });
		}

		FClassOutput Output;
		Output.Declaration = FString::Printf(TEXT("export interface %sProps extends %s {\n%s}\n"), *Class->GetName(), *Base, *Body);
		Output.Runtime = MakeShared<FJsonObject>();
		if (!bRoot)
		{
			Output.Runtime->SetStringField(TEXT("parent"), Parent->GetName());
		}
		Output.Runtime->SetObjectField(TEXT("props"), Props);
		return Output;
	}
}

bool VgeJsxDeclarations::Write(const FString& TypingDir)
{
	TArray<UClass*> Classes;
	for (TObjectIterator<UClass> It; It; ++It)
	{
		if (IsElementClass(*It))
		{
			Classes.Add(*It);
		}
	}
	Classes.Sort([](const UClass& A, const UClass& B) { return A.GetName() < B.GetName(); });

	FString Declarations = TEXT("// Generated by VgeGenTypings from Unreal reflection (VgeJsxDeclarations.cpp). Do not edit.\n")
		TEXT("import type * as UE from 'ue';\n")
		TEXT("import type { ActorElement, ComponentElement, ElementRef, StructProp } from '../../dev/src/shared/react/props';\n\n");
	FString Intrinsics;
	TSharedRef<FJsonObject> Runtime = MakeShared<FJsonObject>();
	int32 Elements = 0;
	for (const UClass* Class : Classes)
	{
		const FClassOutput Output = DescribeClass(Class);
		Declarations += Output.Declaration;
		Runtime->SetObjectField(Class->GetName(), Output.Runtime);
		if (!Class->HasAnyClassFlags(CLASS_Abstract))
		{
			Intrinsics += FString::Printf(TEXT("  %s: %sProps & ElementRef<UE.%s>;\n"), *CamelCase(Class->GetName()), *Class->GetName(), *Class->GetName());
			++Elements;
		}
	}
	// React's JSX namespace is extended from dev/src/shared/react/jsx.d.ts: 'react' does not resolve from Typing/.
	Declarations += TEXT("\nexport interface UeIntrinsicElements {\n") + Intrinsics + TEXT("}\n");

	FString Json;
	FJsonSerializer::Serialize(Runtime, TJsonWriterFactory<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>::Create(&Json));

	const bool bWritten = FFileHelper::SaveStringToFile(Declarations, *(TypingDir / TEXT("ue-jsx.d.ts")), FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM)
		&& FFileHelper::SaveStringToFile(Json, *(TypingDir / TEXT("ue-jsx.json")), FFileHelper::EEncodingOptions::ForceUTF8WithoutBOM);
	UE_LOGF(LogTemp, Display, "VgeJsxDeclarations: %d classes, %d elements -> %ls", Classes.Num(), Elements, *TypingDir);
	return bWritten;
}
