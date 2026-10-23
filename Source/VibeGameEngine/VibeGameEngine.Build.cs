using UnrealBuildTool;

public class VibeGameEngine : ModuleRules
{
	public VibeGameEngine(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
		PublicDependencyModuleNames.Add("JsEnv");
		PrivateDependencyModuleNames.AddRange(new string[] { "Projects", "RenderCore", "WebBrowser", "Slate", "SlateCore", "Json" });
	}
}
