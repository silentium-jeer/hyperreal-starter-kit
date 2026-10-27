import * as UE from 'ue';
import { world } from './world';

const playerController = () => UE.GameplayStatics.GetPlayerController(world, 0) as UE.PlayerController | undefined;

export const isWorldPaused = () => UE.GameplayStatics.IsGamePaused(world);

export function pauseWorldKeepingCamera() {
  const controller = playerController();
  if (controller) controller.bShouldPerformFullTickWhenPaused = true;
  return UE.GameplayStatics.SetGamePaused(world, true);
}

export function resumeWorld() {
  UE.GameplayStatics.SetGamePaused(world, false);
  const controller = playerController();
  if (controller) controller.bShouldPerformFullTickWhenPaused = false;
}
