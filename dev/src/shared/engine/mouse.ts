import * as UE from 'ue';
import { everyFrame, own, world, type Scope } from './world';

// Mouse capture. By default the game does not take the mouse: the cursor is visible and free, and the HUD page's
// controls take clicks. Game code that wants the mouse says so with wantMouseCapture (or useMouseCapture in a
// component): then a click on the game, outside the page's controls, hides and captures the cursor, and Escape
// hands it back. captureMouse and releaseMouse do the same from any other logic.
const ESCAPE = new UE.Key('Escape');
const CLICK = new UE.Key('LeftMouseButton');

const controller = () => UE.GameplayStatics.GetPlayerController(world, 0) as UE.PlayerController | undefined;

export function isMouseCaptured() {
  const player = controller();
  return !!player && !player.bShowMouseCursor;
}

export function captureMouse() {
  const player = controller();
  if (!player) return;
  player.bShowMouseCursor = false;
  UE.WidgetBlueprintLibrary.SetInputMode_GameOnly(player, true);
}

export function releaseMouse() {
  const player = controller();
  if (!player) return;
  player.bShowMouseCursor = true;
  UE.WidgetBlueprintLibrary.SetInputMode_GameAndUIEx(player, undefined, UE.EMouseLockMode.DoNotLock, false, true);
}

// Click on the game captures, Escape releases, while the returned function (or the scope) has not stopped it.
export function wantMouseCapture(scope: Scope = 'scene') {
  const stopTicking = everyFrame(() => {
    const player = controller();
    if (!player) return;
    if (player.bShowMouseCursor) {
      if (player.WasInputKeyJustPressed(CLICK)) captureMouse();
    } else if (player.WasInputKeyJustPressed(ESCAPE)) {
      releaseMouse();
    }
  }, scope);
  return own(() => {
    stopTicking();
    releaseMouse();
  }, scope);
}
