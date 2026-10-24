#include "VgeHelloPlugin.h"

#include "Modules/ModuleManager.h"

IMPLEMENT_MODULE(FDefaultModuleImpl, VgeHelloPlugin)

FString UVgeHelloPlugin::Hello(const FString& Name)
{
	return FString::Printf(TEXT("Hello, %s, from VgeHelloPlugin 1.0"), *Name);
}

int32 UVgeHelloPlugin::Add(int32 A, int32 B)
{
	return A + B;
}
