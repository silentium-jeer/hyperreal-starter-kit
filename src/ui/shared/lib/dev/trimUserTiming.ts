const TRIM_INTERVAL_MS = 10_000

export function trimUserTimingInDev(): void {
  if (!import.meta.env.DEV) return
  if (typeof performance === 'undefined' || typeof performance.clearMeasures !== 'function') return
  window.setInterval(() => performance.clearMeasures(), TRIM_INTERVAL_MS)
}
