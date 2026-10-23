import * as UE from 'ue';
import { useEffect, useRef } from 'react';
import { gameInstance } from '../engine/world';

export type HudMessage = { type: string; [key: string]: unknown };

const hudPage = () => gameInstance.UI as UE.VgeUI;

export function sendToHud(message: HudMessage) {
  hudPage().Send(JSON.stringify(message));
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
