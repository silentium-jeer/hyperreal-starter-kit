#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

class USkeletalMesh;

// A humanoid ragdoll for an imported skeletal mesh. The physics asset an import generates uses the engine's default
// creation parameters (PhysicsAssetUtils.h FPhysAssetCreateParams): bones under 20 cm are merged into their parents
// (no forearms, no spine segments), collision is disabled between every pair of bodies (the head passes through the
// pelvis), and every joint gets the same soft 45-degree limits. This builds the asset again the way the editor's
// "Create Physics Asset" does, with parameters for a character, then gives each joint a hard limit and each body a
// mass by the role of its bone (pelvis, spine, neck, head, clavicle, upper arm, forearm, hand, thigh, calf, foot),
// read from the bone's name (Mixamo, Unreal mannequin and similar rigs).
namespace VgeRagdoll
{
	// Rebuilds `Mesh`'s physics asset in place. Returns { bodies: [{ bone, role, mass }], constraints } or { error }.
	TSharedRef<FJsonObject> Build(USkeletalMesh* Mesh);
}
