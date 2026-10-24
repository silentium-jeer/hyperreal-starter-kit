import { useEffect } from 'react';
import { wantMouseCapture } from '../engine/mouse';

// While the calling component is mounted, a click on the game captures the mouse and Escape releases it
// (the browser's pointer lock: requested by the page on a click, given back on Escape).
export function useMouseCapture() {
  useEffect(() => wantMouseCapture(), []);
}
