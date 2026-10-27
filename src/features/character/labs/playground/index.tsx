import * as UE from 'ue';
import { useState } from 'react';
import { LabStage } from '../../../../scenes/lab-stage/LabStage';
import { world } from '../../../../shared/engine/world';
import { useHudMessages, useHudState } from '../../../../shared/react';
import { BoxPyramid, Stairs } from '../../../world';
import { Player } from '../../entities/Player';

const MOVEMENT_MODES = ['None', 'Walking', 'NavWalking', 'Falling', 'Swimming', 'Flying', 'Custom'];

export function Scene() {
  const [steps, setSteps] = useState(12);
  const [rows, setRows] = useState(4);
  const [round, setRound] = useState(0);

  useHudMessages((message) => {
    if (message.type === 'playground/steps') setSteps(Number(message.steps));
    if (message.type === 'playground/rows') setRows(Number(message.rows));
    if (message.type === 'playground/reset') setRound((value) => value + 1);
  });
  useHudState('playground/state', () => {
    const pawn = UE.GameplayStatics.GetPlayerPawn(world, 0) as UE.Character | undefined;
    const movement = pawn?.CharacterMovement;
    const velocity = movement ? movement.Velocity : undefined;
    return {
      steps,
      rows,
      speed: velocity ? Math.round(Math.hypot(velocity.X, velocity.Y)) : 0,
      mode: movement ? MOVEMENT_MODES[movement.MovementMode] ?? String(movement.MovementMode) : '',
    };
  });

  return (
    <>
      <LabStage groundSize={30} camera={null} />
      <Player key={`player-${round}`} at={[-200, 0, 100]} />
      <Stairs key={`stairs-${round}-${steps}`} at={[-150, 350, 0]} steps={steps} />
      <BoxPyramid key={`pyramid-${round}-${rows}`} at={[300, 0, 0]} rows={rows} />
    </>
  );
}
