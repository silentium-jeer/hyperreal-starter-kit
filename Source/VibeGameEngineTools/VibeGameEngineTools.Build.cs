using UnrealBuildTool;

// Headless tools that run inside UnrealEditor-Cmd: typings generation and the content service.
public class VibeGameEngineTools : ModuleRules
{
	public VibeGameEngineTools(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
		PrivateDependencyModuleNames.AddRange(new string[] { "UnrealEd", "DeclarationGenerator", "AssetTools", "Json", "InterchangeCore", "InterchangeEngine", "InterchangePipelines" });
	}
}
