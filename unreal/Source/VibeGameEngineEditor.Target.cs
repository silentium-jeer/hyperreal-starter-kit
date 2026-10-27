using UnrealBuildTool;

// The editor target exists only so the headless cooker (UnrealEditor-Cmd) can load the project's modules.
public class VibeGameEngineEditorTarget : TargetRules
{
	public VibeGameEngineEditorTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Editor;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.AddRange(new string[] { "VibeGameEngine", "VibeGameEngineTools" });
	}
}
