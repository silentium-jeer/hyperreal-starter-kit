---
name: mixamo-characters
description: >-
  Bring a character of your own into a game on this kit: a model with its skin and animation-only clips (Mixamo or
  any DCC), each imported with one import line, Manny's animations retargeted onto it or its clips onto Manny, and
  the player's body swapped for it. MANDATORY before importing a character or animations, retargeting, or when an
  imported character stretches, folds, falls apart or stands in its bind pose. Trigger on: "Mixamo", "character
  import", "animation import", "retarget", "IK Rig", "IK Retargeter", "swap the mannequin", "my own character",
  "player model", "the character falls apart", "the character stretches", "T-pose", "bind pose".
---

# Characters from Mixamo

Three labs show the whole path, start from them (`npm run shell`, Labs, character), their files are in
`src/features/character/assets/mixamo`:

- `mixamo-character`: the standard Mixamo mannequin (`default-humanoid.fbx`, With Skin) with Mixamo clips made for it
  (Without Skin), each imported onto its skeleton.
- `mixamo-to-manny`: the same clips retargeted onto Unreal's Manny, beside the originals.
- `custom-player`: the player with Manny swapped for the Mixamo mannequin, Manny's unarmed set retargeted onto it.

## Import lines

```ts
import mixamo from './default-humanoid.fbx';                                                  // the model, With Skin
import idle from './animations/idle.fbx?skeleton=../default-humanoid.fbx';                     // a clip, Without Skin, on its skeleton
import idleOnManny from './animations/idle.fbx?skeleton=../default-humanoid.fbx&retarget=manny'; // that clip retargeted onto Manny
import mixamoMoves from './default-humanoid.fbx?retargetFrom=manny';                              // Manny's unarmed set retargeted onto it
```

- `skeleton` names the model file the clip was made for, relative to the clip. The clip is imported onto that model's
  skeleton (content service `import-animations`). The model is imported first in the same build if it has none.
- `retarget` and `retargetFrom` take `manny` (Manny and his unarmed set in `/Game/Characters/Mannequins`,
  `vge/content/characters.mjs` CHARACTERS) or another model file. The content service generates an IK Rig for each
  skeleton and an IK Retargeter and batch-retargets the animations: the steps the editor's Retarget Animations window
  takes with "Auto Generate Retargeter" (`unreal/Source/VibeGameEngineTools/Private/VgeRetargeter.cpp`, after
  `SRetargetAnimAssetsWindow.cpp` FProceduralRetargetAssets). The retargeted copies keep their names.
- Saving the model rebuilds it and every import built on it.
- In the game: `ImportedCharacter` (`entities/ImportedCharacter.tsx`) shows a model or a project mesh playing a clip
  import; `<Player look={{ mesh, clips }} />` runs the player's locomotion graph on another body;
  `locomotionClipsIn(objects)` picks the locomotion set out of a `retargetFrom` import.

## What breaks characters on import

- **Two scales.** A Mixamo FBX that went through Blender or glTF often carries a 100x or 0.01x scale on the armature;
  the clips' bone translations then stretch or fold the body. Keep the model and its clips in the files Mixamo gave
  (FBX, With Skin and Without Skin), or export both the same way.
- **Two bone namings.** The decode step drops `:` from glTF node names (`mixamorig:Hips` becomes `mixamorigHips`),
  FBX keeps it. A glTF model with FBX clips leaves the unmatched bones in the bind pose. One format for a model and
  its clips.
- **Another skeleton.** Mixamo builds a skeleton for each uploaded character's proportions. A clip made for one
  character played on another stretches it: put it on the other character with `retarget`, never with `skeleton`.

None of this needs the kit's C++ or the importer changed (AGENTS.md, "pick the layer"): a character that imports
wrong is fixed in its files.
