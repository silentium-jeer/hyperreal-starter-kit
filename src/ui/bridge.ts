export type GameMessage = { type: string; [key: string]: unknown };

interface VgeBinding {
  post(json: string): void;
  setinteractiverects(json: string): void;
}

declare global {
  interface Window {
    ue?: { vge?: VgeBinding };
    __vgeReceive?: (message: GameMessage) => void;
  }
}

const listeners = new Set<(message: GameMessage) => void>();
window.__vgeReceive = (message) => listeners.forEach((listener) => listener(message));

export const inGame = () => Boolean(window.ue?.vge);

export function post(message: GameMessage) {
  if (window.ue?.vge) window.ue.vge.post(JSON.stringify(message));
  else console.log('[ui] no game bridge, would post', message);
}

export function onGameMessage(listener: (message: GameMessage) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

let scheduled = false;
function reportInteractiveRects() {
  scheduled = false;
  const rects = [...document.querySelectorAll<HTMLElement>('[data-hit]')].map((element) => {
    const r = element.getBoundingClientRect();
    return [r.x, r.y, r.width, r.height];
  });
  window.ue?.vge?.setinteractiverects(JSON.stringify({ width: window.innerWidth, rects }));
}
function scheduleReport() {
  if (!scheduled) {
    scheduled = true;
    requestAnimationFrame(reportInteractiveRects);
  }
}
new MutationObserver(scheduleReport).observe(document.documentElement, { subtree: true, childList: true, attributes: true });
new ResizeObserver(scheduleReport).observe(document.documentElement);
window.addEventListener('resize', scheduleReport);
