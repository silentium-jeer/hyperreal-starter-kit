import * as UE from 'ue';
import { releaseMouse } from '../shared/engine/mouse';
import { gameInstance } from '../shared/engine/world';

const ui = gameInstance.UI as UE.VgeUI;
const pageUrl = () => (import.meta.env.DEV ? `${devServerHttp()}/src/ui/hud.html` : 'https://ui.vge/src/ui/hud.html');

export const devServerHttp = () => (gameInstance.DevServerUrl as string).replace(/^ws/, 'http').replace(/\/__unreal$/, '');

export function mountUIHost() {
  if (!ui.IsShown()) ui.Show(pageUrl());
  releaseMouse();
}
