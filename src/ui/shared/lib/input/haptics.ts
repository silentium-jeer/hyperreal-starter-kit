import { prefersReducedMotion } from '../a11y/reducedMotion'

export function triggerHaptic(durationMs = 8): void {
  if (prefersReducedMotion()) return
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(durationMs)
  }
}
