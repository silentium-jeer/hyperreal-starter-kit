import * as UE from 'ue';
import { $ref } from 'puerts';
import { useRef, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { useEvery, useFrame, useHudMessages, useHudState, useSound } from '../../../../shared/react';
import bass from '../../assets/sounds/bass.wav';
import pad from '../../assets/sounds/pad19.wav';
import pop from '../../assets/sounds/pop.wav';
import tick from '../../assets/sounds/tick.wav';
import whoosh from '../../assets/sounds/whoosh.wav';

const SPEAKER_RADIUS_CM = 600;
const SPEAKER_TURNS_PER_SECOND = 0.1;
const ignoredHit = $ref(new UE.HitResult());

function useEffects() {
  return { pop: useSound(pop), whoosh: useSound(whoosh), bass: useSound(bass) };
}

export function Scene() {
  const speaker = useRef<UE.StaticMeshActor | null>(null);
  const angle = useRef(0);
  const music = useRef<UE.AudioComponent | undefined>(undefined);
  const [ticking, setTicking] = useState(true);
  const [musicOn, setMusicOn] = useState(false);
  const [played, setPlayed] = useState(0);
  const effects = useEffects();
  const speakerTick = useSound(tick);
  const padTrack = useSound(pad);

  useFrame((deltaSeconds) => {
    angle.current = (angle.current + deltaSeconds * SPEAKER_TURNS_PER_SECOND * Math.PI * 2) % (Math.PI * 2);
    speaker.current?.K2_SetActorLocation(new UE.Vector(Math.cos(angle.current) * SPEAKER_RADIUS_CM, Math.sin(angle.current) * SPEAKER_RADIUS_CM, 100), false, ignoredHit, false);
  });
  useEvery(1000, () => {
    const component = speaker.current?.StaticMeshComponent;
    if (ticking && component && speakerTick.play({ attachTo: component, falloffCm: 2400 })) setPlayed((value) => value + 1);
  });
  useHudMessages((message) => {
    if (message.type === 'sound/effect' && String(message.effect) in effects && effects[String(message.effect) as keyof typeof effects].play()) setPlayed((value) => value + 1);
    if (message.type === 'sound/ticking') setTicking(Boolean(message.value));
    if (message.type !== 'sound/music') return;
    music.current?.Stop();
    music.current = message.value ? padTrack.play() : undefined;
    setMusicOn(Boolean(music.current));
  });
  useHudState('sound/state', () => ({
    ready: { tick: speakerTick.ready, pad: padTrack.ready, ...Object.fromEntries(Object.entries(effects).map(([name, effect]) => [name, effect.ready])) },
    effects: Object.keys(effects), ticking, music: musicOn && Boolean(music.current?.IsPlaying()), played,
  }));

  return (
    <>
      <LabStage sunPitch={-35} />
      <staticMeshActor ref={speaker} location={[SPEAKER_RADIUS_CM, 0, 100]} staticMeshComponent={{ staticMesh: '/Engine/BasicShapes/Cube.Cube', mobility: UE.EComponentMobility.Movable }} scale={[0.6, 0.6, 0.6]} />
    </>
  );
}
