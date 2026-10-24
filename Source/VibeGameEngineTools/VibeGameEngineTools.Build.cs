using System.IO;
using UnrealBuildTool;

// Headless tools that run inside UnrealEditor-Cmd: typings generation and the content service.
public class VibeGameEngineTools : ModuleRules
{
	public VibeGameEngineTools(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
		PublicDependencyModuleNames.AddRange(new string[] { "Core", "CoreUObject", "Engine" });
		PrivateDependencyModuleNames.AddRange(new string[] { "UnrealEd", "DeclarationGenerator", "AssetTools", "Json", "InterchangeCore", "InterchangeEngine", "InterchangePipelines" });
		// Materials described in TypeScript (VgeMaterialBuilder.cpp): the material editor's scripting library.
		PrivateDependencyModuleNames.Add("MaterialEditor");
		// Fab in the content service (VgeFab.cpp): EOS sign-in, HTTP, and BuildPatchServices' interfaces for the
		// engine Fab plugin's BuildPatchInstallerLib, loaded through that plugin's own header-only helper.
		PrivateDependencyModuleNames.AddRange(new string[] { "EOSSDK", "EOSShared", "HTTP", "BuildPatchServices", "Projects" });
		PrivateIncludePaths.Add(Path.Combine(EngineDirectory, "Plugins", "Fab", "Source", "Fab", "Private"));
	}
}
