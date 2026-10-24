import * as UE from 'ue';
import { useEffect, useRef, useState } from 'react';
import { LabStage } from '../lab-stage/LabStage';
import { Player } from '../../features/character/entities/Player';
import { flightCase, LiveAsset, SpinningCubes } from '../../features/demo';
import { BoxPyramid, Colonnade, SphereRain, Stairs } from '../../features/world';
import { sendToHud, useFrame, useHudMessages } from '../../shared/react';

const HUD_STATE_EVERY_MS = 250;
const DEFAULT_SUN_PITCH = -35;

function useSmoothedFps() {
  const fps = useRef(0);
  useFrame((deltaSeconds) => {
    if (deltaSeconds <= 0) return;
    const now = 1 / deltaSeconds;
    fps.current = fps.current ? fps.current * 0.95 + now * 0.05 : now;
  });
  return fps;
}

// The engine's scalability level (0 Low .. 4 Cinematic, -1 when the groups differ), applied for the whole game.
const qualityLevel = () => UE.GameUserSettings.GetGameUserSettings().GetOverallScalabilityLevel();
function setQualityLevel(level: number) {
  const settings = UE.GameUserSettings.GetGameUserSettings();
  settings.SetOverallScalabilityLevel(level);
  // Not ApplySettings: that also applies the stored resolution and window mode and takes the window fullscreen.
  settings.ApplyNonResolutionSettings();
}

export function Scene() {
  const [sunPitch, setSunPitch] = useState(DEFAULT_SUN_PITCH);
  const [raining, setRaining] = useState(false);
  const fps = useSmoothedFps();

  useHudMessages((message) => {
    if (message.type === 'main/sun') setSunPitch(Number(message.pitch));
    if (message.type === 'main/rain') setRaining(Boolean(message.on));
    if (message.type === 'main/quality') setQualityLevel(Number(message.level));
  });

  useEffect(() => {
    const timer = setInterval(
      () => sendToHud({ type: 'main/state', fps: Math.round(fps.current), sunPitch, raining, quality: qualityLevel() }),
      HUD_STATE_EVERY_MS,
    );
    return () => clearInterval(timer);
  }, [sunPitch, raining]);

  return (
    <>
      <LabStage groundSize={40} camera={null} sunPitch={sunPitch} />
      <Player at={[-300, 0, 100]} />
      <Colonnade at={[0, 0, 0]} radius={900} columns={20} />
      <Stairs at={[-150, 400, 0]} steps={12} />
      <BoxPyramid at={[350, -250, 0]} rows={5} />
      <SpinningCubes at={[350, 350, 100]} count={3} />
      <LiveAsset asset={flightCase} at={[-100, -400, 45]} />
      {raining && <SphereRain at={[0, 0, 0]} area={700} everyMs={250} max={40} />}
    </>
  );
}
