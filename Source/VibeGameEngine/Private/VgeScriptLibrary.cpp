#include "VgeScriptLibrary.h"

#include "Components/ActorComponent.h"

void UVgeScriptLibrary::ReregisterComponent(UActorComponent* Component)
{
	if (Component && Component->IsRegistered())
	{
		Component->ReregisterComponent();
	}
}
