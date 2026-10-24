import type * as UE from 'ue';
import type { Ref } from 'react';
import { param } from '../../../shared/react';

// The Mannequin's locomotion as an animation graph: idle, walk and run blended by speed, jump, fall and land, on
// the Third Person template's unarmed clips. It reads three graph variables the owner sets every frame from
// CharacterMovement (setLocomotion): speed (horizontal, cm/s), falling and velocityZ.

const ANIMS = '/Game/Characters/Mannequins/Anims/Unarmed';
const IDLE_WALK_RUN = `${ANIMS}/BS_Idle_Walk_Run.BS_Idle_Walk_Run`;
const JUMP = `${ANIMS}/Jump/MM_Jump.MM_Jump`;
const FALL = `${ANIMS}/Jump/MM_Fall_Loop.MM_Fall_Loop`;
const LAND = `${ANIMS}/Jump/MM_Land.MM_Land`;

// Faster than this, a landing hands over to locomotion at once instead of playing out.
const MOVING_SPEED = 50;
// Rising faster than this when leaving the ground is a jump; slower, a fall from a ledge.
const JUMP_VELOCITY = 100;

export function setLocomotion(graph: UE.VgeAnimInstance | null, movement: UE.CharacterMovementComponent) {
  if (!graph) return;
  const velocity = movement.Velocity;
  graph.SetFloat('speed', Math.hypot(velocity.X, velocity.Y));
  graph.SetFloat('velocityZ', velocity.Z);
  graph.SetBool('falling', movement.IsFalling());
}

export function MannequinLocomotion({ graph }: { graph: Ref<UE.VgeAnimInstance> }) {
  return (
    <animGraph ref={graph}>
      <inertialize>
        <slot name="DefaultSlot">
          <stateMachine entry="locomotion">
            <state name="locomotion">
              {/* BS_Idle_Walk_Run: x is the direction off the facing (0: the character turns to its movement), y the speed. */}
              <blendSpace blendSpace={IDLE_WALK_RUN} x={0} y={param('speed')} />
            </state>
            <state name="jump">
              <clip sequence={JUMP} loop={false} />
            </state>
            <state name="fall">
              <clip sequence={FALL} />
            </state>
            <state name="land">
              <clip sequence={LAND} loop={false} />
            </state>
            <transition from="locomotion" to="jump" when={`falling && velocityZ > ${JUMP_VELOCITY}`} duration={0.15} blend="inertialization" />
            <transition from="locomotion" to="fall" when="falling" duration={0.3} blend="inertialization" />
            <transition from="jump" to="land" when="!falling" duration={0.1} blend="inertialization" />
            <transition from="jump" to="fall" when="timeRemaining < 0.2" duration={0.2} blend="inertialization" />
            <transition from="fall" to="land" when="!falling" duration={0.1} blend="inertialization" />
            <transition from="land" to="locomotion" when={`speed > ${MOVING_SPEED} || timeRemaining < 0.25`} duration={0.25} blend="inertialization" />
          </stateMachine>
        </slot>
      </inertialize>
    </animGraph>
  );
}
