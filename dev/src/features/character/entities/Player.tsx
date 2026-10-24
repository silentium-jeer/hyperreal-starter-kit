import * as UE from 'ue';
import { $ref, $unref } from 'puerts';
import { useEffect, useRef } from 'react';
import { viewFrom, world } from '../../../shared/engine/world';
import { isMouseCaptured } from '../../../shared/engine/mouse';
import { useFrame, useMouseCapture } from '../../../shared/react';
import type { Vector3 } from '../../../shared/react/props';
import { MANNEQUIN_MESHES, type MannequinVariant } from './mannequin';

// The player: a stock Mannequin on an ACharacter (capsule + CharacterMovement), driven by WASD and Space or a
// gamepad's left stick and A, with a camera orbiting it, turned by the captured mouse or the right stick. Movement
// is relative to the camera's heading. It is animated by the Third Person template's own animation graph
// (ABP_Unarmed: idle / walk / run blended by speed, jump, fall and land), which reads CharacterMovement itself.
const CAPSULE_HALF_HEIGHT = 88;
const ANIMATION_GRAPH = '/Game/Characters/Mannequins/Anims/Unarmed/ABP_Unarmed.ABP_Unarmed_C';
const CAMERA_DISTANCE = 560;
const CAMERA_TARGET_HEIGHT = 90;
const CAMERA_START_PITCH = -18;
const PITCH_RANGE = [-70, 20] as const;
const MOUSE_DEGREES_PER_UNIT = 0.4;
const STICK_DEGREES_PER_SECOND = 140;
const STICK_DEADZONE = 0.15;
const KEYS = {
  forward: new UE.Key('W'), back: new UE.Key('S'), left: new UE.Key('A'), right: new UE.Key('D'), jump: new UE.Key('SpaceBar'),
  padJump: new UE.Key('Gamepad_FaceButton_Bottom'),
  moveX: new UE.Key('Gamepad_LeftX'), moveY: new UE.Key('Gamepad_LeftY'), lookX: new UE.Key('Gamepad_RightX'), lookY: new UE.Key('Gamepad_RightY'),
};
const UP = new UE.Vector(0, 0, 1);

const stick = (controller: UE.PlayerController, key: UE.Key) => {
  const value = controller.GetInputAnalogKeyState(key);
  return Math.abs(value) < STICK_DEADZONE ? 0 : value;
};
const pressed = (controller: UE.PlayerController, key: UE.Key) => (controller.IsInputKeyDown(key) ? 1 : 0);

export interface PlayerProps {
  at: Vector3;
  variant?: MannequinVariant;
}

export function Player({ at, variant = 'manny' }: PlayerProps) {
  const character = useRef<UE.Character>(null);
  const camera = useRef<UE.CameraActor>(null);
  useEffect(() => {
    const mesh = character.current!.Mesh;
    mesh.SetAnimationMode(UE.EAnimationMode.AnimationBlueprint, true);
    mesh.SetAnimInstanceClass(UE.Class.Load(ANIMATION_GRAPH));
    UE.GameplayStatics.GetPlayerController(world, 0).Possess(character.current!);
    viewFrom(camera.current!);
  }, []);

  useMouseCapture();
  const heading = useRef({ yaw: 0, pitch: CAMERA_START_PITCH });
  const ignoredHit = $ref(new UE.HitResult());
  const mouseX = $ref(0);
  const mouseY = $ref(0);
  // Every frame: CharacterMovement consumes input per tick, so input fed less often is lost to braking.
  useFrame((deltaSeconds) => {
    const pawn = character.current;
    if (!pawn) return;
    const controller = UE.GameplayStatics.GetPlayerController(world, 0);
    if (!controller) return;

    const view = heading.current;
    let turnX = stick(controller, KEYS.lookX) * STICK_DEGREES_PER_SECOND * deltaSeconds;
    let turnY = stick(controller, KEYS.lookY) * STICK_DEGREES_PER_SECOND * deltaSeconds;
    if (isMouseCaptured()) {
      controller.GetInputMouseDelta(mouseX, mouseY);
      turnX += $unref(mouseX) * MOUSE_DEGREES_PER_UNIT;
      turnY += $unref(mouseY) * MOUSE_DEGREES_PER_UNIT;
    }
    view.yaw = (view.yaw + turnX) % 360;
    view.pitch = Math.min(PITCH_RANGE[1], Math.max(PITCH_RANGE[0], view.pitch + turnY));

    const yaw = (view.yaw * Math.PI) / 180;
    const forward = new UE.Vector(Math.cos(yaw), Math.sin(yaw), 0);
    const right = new UE.Vector(-Math.sin(yaw), Math.cos(yaw), 0);
    const x = Math.max(-1, Math.min(1, pressed(controller, KEYS.forward) - pressed(controller, KEYS.back) + stick(controller, KEYS.moveY)));
    const y = Math.max(-1, Math.min(1, pressed(controller, KEYS.right) - pressed(controller, KEYS.left) + stick(controller, KEYS.moveX)));
    if (x) pawn.AddMovementInput(forward, x, false);
    if (y) pawn.AddMovementInput(right, y, false);
    if (controller.IsInputKeyDown(KEYS.jump) || controller.IsInputKeyDown(KEYS.padJump)) pawn.Jump();

    const rotation = new UE.Rotator(view.pitch, view.yaw, 0);
    const target = UE.KismetMathLibrary.Add_VectorVector(pawn.K2_GetActorLocation(), UE.KismetMathLibrary.Multiply_VectorFloat(UP, CAMERA_TARGET_HEIGHT));
    const back = UE.KismetMathLibrary.Multiply_VectorFloat(UE.KismetMathLibrary.GetForwardVector(rotation), -CAMERA_DISTANCE);
    camera.current?.K2_SetActorLocationAndRotation(UE.KismetMathLibrary.Add_VectorVector(target, back), rotation, false, ignoredHit, false);
  });

  return (
    <>
      <character
        ref={character}
        location={at}
        useControllerRotationYaw={false}
        // Mannequin meshes face local +Y with the pivot at the feet; the capsule's origin is its centre.
        mesh={{ skeletalMeshAsset: MANNEQUIN_MESHES[variant], location: [0, 0, -CAPSULE_HALF_HEIGHT], rotation: [0, -90, 0] }}
        characterMovement={{ orientRotationToMovement: true, rotationRate: [0, 720, 0], maxWalkSpeed: 450, jumpZVelocity: 520 }}
      />
      <cameraActor ref={camera} location={at} rotation={[CAMERA_START_PITCH, 0, 0]} cameraComponent={{ constrainAspectRatio: false }} />
    </>
  );
}
