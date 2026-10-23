import * as UE from 'ue';
import { colored, viewFrom } from '../../shared/engine/world';
import type { Vector3 } from '../../shared/react/props';

// The shared stage React labs render instead of building their own sun, sky, ground and camera.
export interface LabStageProps {
  ground?: boolean;
  groundSize?: number;
  camera?: { location: Vector3; rotation: Vector3 } | null;
  sunPitch?: number;
  sunYaw?: number;
}

const CUBE = '/Engine/BasicShapes/Cube.Cube';

export function LabStage({ ground = true, groundSize = 40, camera = { location: [-900, 0, 420], rotation: [-20, 0, 0] }, sunPitch = -35, sunYaw = 40 }: LabStageProps) {
  return (
    <>
      <directionalLight location={[0, 0, 500]} rotation={[sunPitch, sunYaw, 0]} lightComponent={{ mobility: UE.EComponentMobility.Movable, intensity: 8 }} directionalLightComponent={{ atmosphereSunLight: true }} />
      <skyAtmosphere />
      {/* The sky atmosphere draws nothing below the horizon; height fog fills it with the sky's own colour. */}
      <exponentialHeightFog />
      <skyLight location={[0, 0, 200]} lightComponent={{ mobility: UE.EComponentMobility.Movable, realTimeCapture: true }} />
      {/* A thin box rather than the plane: it has solid box collision for characters and physics bodies. */}
      {ground && <staticMeshComponent location={[0, 0, -5]} scale={[groundSize, groundSize, 0.1]} staticMesh={CUBE} overrideMaterials={[colored([0.35, 0.35, 0.38])]} />}
      {camera && (
        // ACameraActor constrains to 16:9 by default (CameraActor.cpp), which letterboxes any other window shape.
        <cameraActor ref={(actor) => {
            if (actor) viewFrom(actor);
          }} location={camera.location} rotation={camera.rotation} cameraComponent={{ constrainAspectRatio: false }} />
      )}
    </>
  );
}
