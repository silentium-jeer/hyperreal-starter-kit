import * as UE from 'ue';
import { $ref } from 'puerts';
import { useEffect, useRef } from 'react';
import { viewFrom, world } from '../../../shared/engine/world';
import { useFrame } from '../../../shared/react';
import type { Vector3 } from '../../../shared/react/props';
import { MANNEQUIN_MESHES, clipPlayer, mannequinClips, type MannequinVariant } from './mannequin';
import type { ModularCharacterLook } from './modularCharacter';

// The player: a stock Mannequin on an ACharacter (capsule + CharacterMovement), driven by WASD and Space,
// followed by a camera. Its clips are chosen every frame from the movement state (idle, running,
// jump_start / jump_loop / jump_land).
const CAPSULE_HALF_HEIGHT = 88;
const CAMERA_OFFSET = new UE.Vector(-520, 0, 260);
const KEYS = { forward: new UE.Key('W'), back: new UE.Key('S'), left: new UE.Key('A'), right: new UE.Key('D'), jump: new UE.Key('SpaceBar') };
const FORWARD = new UE.Vector(1, 0, 0);
const RIGHT = new UE.Vector(0, 1, 0);

// The clip for this frame, or null to keep the current one. A jump plays its start once, loops in the air
// and plays its landing once, unless the character runs off.
function locomotionClip(look: ModularCharacterLook, falling: boolean, moving: boolean): { clip: string; loop: boolean } | null {
  const current = look.playing();
  const has = (clip: string) => look.clips().includes(clip);
  if (falling) {
    if (current === 'jump_start' && !look.finished()) return null;
    if (current !== 'jump_loop' && current !== 'jump_start' && has('jump_start')) return { clip: 'jump_start', loop: false };
    return { clip: 'jump_loop', loop: true };
  }
  if (moving) return { clip: has('running') ? 'running' : 'idle', loop: true };
  if (current === 'jump_loop' || current === 'jump_start') return { clip: has('jump_land') ? 'jump_land' : 'idle', loop: !has('jump_land') };
  if (current === 'jump_land' && !look.finished()) return null;
  return { clip: 'idle', loop: true };
}

export interface PlayerProps {
  at: Vector3;
  variant?: MannequinVariant;
}

export function Player({ at, variant = 'manny' }: PlayerProps) {
  const character = useRef<UE.Character>(null);
  const camera = useRef<UE.CameraActor>(null);
  const look = useRef<ModularCharacterLook>(null);

  useEffect(() => {
    look.current = clipPlayer(character.current!.Mesh, mannequinClips());
    UE.GameplayStatics.GetPlayerController(world, 0).Possess(character.current!);
    viewFrom(camera.current!);
  }, []);

  const ignoredHit = $ref(new UE.HitResult());
  // Every frame: CharacterMovement consumes input per tick, so input fed less often is lost to braking.
  useFrame(() => {
    const pawn = character.current;
    if (!pawn || !look.current) return;
    const controller = UE.GameplayStatics.GetPlayerController(world, 0);
    const x = (controller.IsInputKeyDown(KEYS.forward) ? 1 : 0) - (controller.IsInputKeyDown(KEYS.back) ? 1 : 0);
    const y = (controller.IsInputKeyDown(KEYS.right) ? 1 : 0) - (controller.IsInputKeyDown(KEYS.left) ? 1 : 0);
    if (x) pawn.AddMovementInput(FORWARD, x, false);
    if (y) pawn.AddMovementInput(RIGHT, y, false);
    if (controller.IsInputKeyDown(KEYS.jump)) pawn.Jump();

    camera.current?.K2_SetActorLocation(UE.KismetMathLibrary.Add_VectorVector(pawn.K2_GetActorLocation(), CAMERA_OFFSET), false, ignoredHit, false);

    const next = locomotionClip(look.current, pawn.CharacterMovement.IsFalling(), UE.KismetMathLibrary.VSize(pawn.GetVelocity()) > 20);
    if (next && look.current.playing() !== next.clip) look.current.play(next.clip, next.loop);
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
      <cameraActor ref={camera} location={[at[0] + CAMERA_OFFSET.X, at[1] + CAMERA_OFFSET.Y, at[2] + CAMERA_OFFSET.Z]} rotation={[-18, 0, 0]} cameraComponent={{ constrainAspectRatio: false }} />
    </>
  );
}
