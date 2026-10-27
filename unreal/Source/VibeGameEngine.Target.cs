using UnrealBuildTool;

public class VibeGameEngineTarget : TargetRules
{
	public VibeGameEngineTarget(TargetInfo Target) : base(Target)
	{
		Type = TargetType.Game;
		DefaultBuildSettings = BuildSettingsVersion.Latest;
		IncludeOrderVersion = EngineIncludeOrderVersion.Latest;
		ExtraModuleNames.Add("VibeGameEngine");
	}
}
