import { useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useContentAsset, useHudMessages, useHudState } from '../../../../shared/react';
import { MIXAMO_CLIPS, mixamo, type MixamoClip } from '../../assets/mixamo';
import { ImportedCharacter } from '../../entities/ImportedCharacter';
import { MANNEQUIN_MESHES } from '../../entities/mannequin';

export function Scene() {
  const [clip, setClip] = useState<MixamoClip>('walking');
  const source = useContentAsset(MIXAMO_CLIPS[clip].clip);
  const retargeted = useContentAsset(MIXAMO_CLIPS[clip].onManny);

  useHudMessages((message) => {
    if (message.type === 'mixamoToManny/clip' && String(message.clip) in MIXAMO_CLIPS) setClip(message.clip as MixamoClip);
  });
  useHudState('mixamoToManny/state', () => ({
    clips: Object.keys(MIXAMO_CLIPS),
    clip,
    source: source?.animations[0] ?? '',
    retargeted: retargeted?.animations[0] ?? '',
    importing: !source || !retargeted,
  }));

  return (
    <>
      <LabStage groundSize={10} camera={{ location: [-480, 0, 140], rotation: [-8, 0, 0], focus: [0, 0, 95] }} />
      <ImportedCharacter model={mixamo} clip={MIXAMO_CLIPS[clip].clip} location={[0, -110, 0]} />
      <ImportedCharacter mesh={MANNEQUIN_MESHES.manny} clip={MIXAMO_CLIPS[clip].onManny} location={[0, 110, 0]} />
    </>
  );
}
