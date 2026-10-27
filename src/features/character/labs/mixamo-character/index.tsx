import * as UE from 'ue';
import { useRef, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useContentAsset, useHudMessages, useHudState } from '../../../../shared/react';
import { MIXAMO_CLIPS, mixamo, type MixamoClip } from '../../assets/mixamo';
import { ImportedCharacter } from '../../entities/ImportedCharacter';

export function Scene() {
  const [clip, setClip] = useState<MixamoClip>('idle');
  const component = useRef<UE.SkeletalMeshComponent>(null);
  const model = useContentAsset(mixamo);
  const animation = useContentAsset(MIXAMO_CLIPS[clip].clip);

  useHudMessages((message) => {
    if (message.type === 'mixamoCharacter/clip' && String(message.clip) in MIXAMO_CLIPS) setClip(message.clip as MixamoClip);
  });
  useHudState('mixamoCharacter/state', () => {
    const playing = component.current;
    return {
      clips: Object.keys(MIXAMO_CLIPS),
      clip,
      mesh: model?.skeletalMeshes[0] ?? '',
      skeleton: model?.objects.find((object) => object.class === 'Skeleton')?.path ?? '',
      bones: playing ? playing.GetNumBones() : 0,
      animation: animation?.animations[0] ?? '',
      time: playing ? playing.GetPosition() : 0,
      importing: !model || !animation,
    };
  });

  return (
    <>
      <LabStage groundSize={10} camera={{ location: [-360, 0, 130], rotation: [-8, 0, 0], focus: [0, 0, 95] }} />
      <ImportedCharacter model={mixamo} clip={MIXAMO_CLIPS[clip].clip} onReady={(playing) => (component.current = playing)} />
    </>
  );
}
