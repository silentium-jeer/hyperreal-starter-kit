#pragma once

#include "CoreMinimal.h"
#include "Dom/JsonObject.h"

// Fab inside the content service: what the engine's Fab plugin does in the editor for its browser tab
// (Engine/Plugins/Fab/Source/Fab/Private), done the same way here for the kit's Fab window (shell/src/FabWindow,
// vge/content/fab.mjs).
//   fab-token                 the signed-in user's access and refresh token, both empty when nobody is signed in; the
//                             first call signs in from the persistent auth EOS keeps (FabAuthentication::LoginUsingPersist)
//   fab-login                 signs in through the Epic account portal (LoginUsingAccountPortal); answers the token
//   fab-logout                signs out and deletes the persistent auth (DeletePersistentAuth)
//   fab-install               {kind: "pack"|"plugin", manifestUrl, baseUrls, installDir, stagingDir}: downloads a build
//                             (BuildPatchServices manifest and chunks) into installDir with the plugin's own
//                             BuildPatchInstallerLib (FabDownloader.cpp); answers the installed files; a pack also its
//                             missing plugins (PackImportWorkflow.cpp CheckForDependencies)
// Sign-in uses the EOS product of the Fab plugin, from its own constants asset (/Fab/Data/FabEos), as
// FabAuthentication::Init does.
namespace VgeFab
{
	using FReply = TFunction<void(TSharedRef<FJsonObject>)>;

	// Starts Command if it is one of the above and returns true. Reply is called once, on the game thread, with the
	// result (an "error" field when it failed); Progress any number of times before it.
	bool Handle(const FString& Command, const TSharedPtr<FJsonObject>& Request, FReply Reply, FReply Progress);
}
