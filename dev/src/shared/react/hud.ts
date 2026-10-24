import * as UE from 'ue';
import { useEffect, useRef } from 'react';
import { gameInstance } from '../engine/world';

export type HudMessage = { type: string; [key: string]: unknown };

const hudPage = () => gameInstance.UI as UE.VgeUI;

export function sendToHud(message: HudMessage) {
  hudPage().Send(JSON.stringify(message));
}

// Sends the scene's state to its HUD panels a few times a second, as `{ type, ...state() }`: the panels show it and
// leave when it stops coming (dev/ui/hud/useGameState.ts). The latest `state` runs, so it reads the latest props.
const HUD_STATE_EVERY_MS = 200;
export function useHudState(type: string, state: () => Record<string, unknown>) {
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const timer = setInterval(() => sendToHud({ type, ...latest.current() }), HUD_STATE_EVERY_MS);
    return () => clearInterval(timer);
  }, [type]);
}

export function useHudMessages(handle: (message: HudMessage) => void) {
  const latest = useRef(handle);
  latest.current = handle;
  useEffect(() => {
    const listener = (json: string) => latest.current(JSON.parse(json) as HudMessage);
    hudPage().OnMessage.Add(listener);
    return () => hudPage().OnMessage.Remove(listener);
  }, []);
}
