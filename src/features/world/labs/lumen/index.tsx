import * as UE from 'ue';
import { useEffect, useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { surface, world, type Surface } from '../../../../shared/engine/world';
import { useHudMessages, useHudState } from '../../../../shared/react';
import type { Vector3 } from '../../../../shared/react/props';

const CUBE = '/Engine/BasicShapes/Cube.Cube';
const SPHERE = '/Engine/BasicShapes/Sphere.Sphere';

const WHITE: Surface = { color: [0.8, 0.8, 0.8], roughness: 0.6 };
const GLOSSY_FLOOR: Surface = { color: [0.75, 0.75, 0.75], roughness: 0.08 };
const RED: Surface = { color: [0.8, 0.06, 0.04], roughness: 0.7 };
const GREEN: Surface = { color: [0.05, 0.7, 0.1], roughness: 0.7 };
const CHROME: Surface = { color: [0.95, 0.95, 0.95], metallic: 1, roughness: 0.04 };
const GOLD: Surface = { color: [1, 0.72, 0.3], metallic: 1, roughness: 0.25 };
const lamp = (strength: number): Surface => ({ color: [0, 0, 0], emissive: [1, 0.45, 0.15], emissiveStrength: strength });

const GI = { lumen: 1, off: 0 } as const;
const REFLECTIONS = { lumen: 1, screen: 2, off: 0 } as const;
const consoleCommand = (command: string) => UE.KismetSystemLibrary.ExecuteConsoleCommand(world, command, UE.GameplayStatics.GetPlayerController(world, 0));
const consoleInt = (name: string) => UE.KismetSystemLibrary.GetConsoleVariableIntValue(name);

function Slab({ at, size, look, mesh = CUBE }: { at: Vector3; size: Vector3; look: Surface; mesh?: string }) {
  return <staticMeshComponent location={at} scale={[size[0] / 100, size[1] / 100, size[2] / 100]} staticMesh={mesh} overrideMaterials={[surface(look)]} />;
}

export function Scene() {
  const [sunPitch, setSunPitch] = useState(-68);
  const [sunYaw, setSunYaw] = useState(20);
  const [glow, setGlow] = useState(40);
  const [gi, setGi] = useState<keyof typeof GI>('lumen');
  const [reflections, setReflections] = useState<keyof typeof REFLECTIONS>('lumen');

  useEffect(() => consoleCommand(`r.DynamicGlobalIlluminationMethod ${GI[gi]}`), [gi]);
  useEffect(() => consoleCommand(`r.ReflectionMethod ${REFLECTIONS[reflections]}`), [reflections]);
  useEffect(
    () => () => {
      consoleCommand(`r.DynamicGlobalIlluminationMethod ${GI.lumen}`);
      consoleCommand(`r.ReflectionMethod ${REFLECTIONS.lumen}`);
    },
    [],
  );
  useHudMessages((message) => {
    if (message.type === 'lumen/sun') {
      setSunPitch(Number(message.pitch));
      setSunYaw(Number(message.yaw));
    }
    if (message.type === 'lumen/glow') setGlow(Number(message.strength));
    if (message.type === 'lumen/gi' && String(message.method) in GI) setGi(message.method as keyof typeof GI);
    if (message.type === 'lumen/reflections' && String(message.method) in REFLECTIONS) setReflections(message.method as keyof typeof REFLECTIONS);
  });
  useHudState('lumen/state', () => ({
    sunPitch,
    sunYaw,
    glow,
    gi,
    reflections,
    giMethod: consoleInt('r.DynamicGlobalIlluminationMethod'),
    reflectionMethod: consoleInt('r.ReflectionMethod'),
  }));

  return (
    <>
      <LabStage ground={false} sunPitch={sunPitch} sunYaw={sunYaw} camera={{ location: [-480, 0, 260], rotation: [-12, 0, 0] }} />
      <Slab at={[0, 0, -10]} size={[1240, 840, 20]} look={GLOSSY_FLOOR} />
      <Slab at={[-385, 0, 510]} size={[470, 840, 20]} look={WHITE} />
      <Slab at={[385, 0, 510]} size={[470, 840, 20]} look={WHITE} />
      <Slab at={[0, 285, 510]} size={[300, 270, 20]} look={WHITE} />
      <Slab at={[0, -285, 510]} size={[300, 270, 20]} look={WHITE} />
      <Slab at={[0, -410, 250]} size={[1240, 20, 520]} look={RED} />
      <Slab at={[0, 410, 250]} size={[1240, 20, 520]} look={GREEN} />
      <Slab at={[610, 0, 250]} size={[20, 840, 520]} look={WHITE} />
      <Slab at={[-610, 0, 250]} size={[20, 840, 520]} look={WHITE} />
      <Slab at={[595, 0, 260]} size={[10, 220, 120]} look={lamp(glow)} />
      <Slab at={[200, -170, 80]} size={[160, 160, 160]} look={CHROME} mesh={SPHERE} />
      <Slab at={[260, 190, 60]} size={[120, 120, 120]} look={GOLD} />
      <Slab at={[0, 0, 40]} size={[80, 80, 80]} look={WHITE} />
    </>
  );
}
