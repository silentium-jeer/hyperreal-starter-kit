import * as UE from 'ue';
import { gameInstance, world } from '../shared/engine/world';

// Game side of the HUD page (dev/ui/hud.html): the page this game draws over its own scene, served by the dev
// server, or in the release build staged in Content/UI. Scene choice and the lab index are the shell's
// (`npm run shell`), not the game's.
const ui = gameInstance.UI as UE.VgeUI;
// The release page is served from Content/UI by the game itself (UVgeUI's scheme handler for https://ui.vge/).
const pageUrl = () => (import.meta.env.DEV ? `${devServerHttp()}/ui/hud.html` : 'https://ui.vge/ui/hud.html');

// The dev server's HTTP origin, from the WebSocket URL this process was given (-DevServer=).
export const devServerHttp = () => (gameInstance.DevServerUrl as string).replace(/^ws/, 'http').replace(/\/__unreal$/, '');

export function mountUIHost() {
  if (!ui.IsShown()) ui.Show(pageUrl());
  // The cursor stays visible so the page can be used without a mode switch.
  UE.GameplayStatics.GetPlayerController(world, 0).bShowMouseCursor = true;
}
