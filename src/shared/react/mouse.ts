import { useEffect } from 'react';
import { wantMouseCapture } from '../engine/mouse';

export function useMouseCapture() {
  useEffect(() => wantMouseCapture(), []);
}
