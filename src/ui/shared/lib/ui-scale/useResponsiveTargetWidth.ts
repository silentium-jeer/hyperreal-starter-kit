import { useCallback, useSyncExternalStore } from 'react'

export type ResponsiveTargetWidthOptions = {
  readonly desktop: number
  readonly mobilePortrait: number
  readonly phoneMaxWidth?: number
}

export function computeResponsiveTargetWidth({
  desktop,
  mobilePortrait,
  phoneMaxWidth = 720,
}: ResponsiveTargetWidthOptions): number {
  if (typeof window === 'undefined') return desktop
  const portrait = window.innerHeight >= window.innerWidth
  if (portrait && window.innerWidth <= phoneMaxWidth) return mobilePortrait
  return desktop
}

function subscribeToViewport(onChange: () => void): () => void {
  window.addEventListener('resize', onChange)
  window.addEventListener('orientationchange', onChange)
  return () => {
    window.removeEventListener('resize', onChange)
    window.removeEventListener('orientationchange', onChange)
  }
}

export function useResponsiveTargetWidth(options: ResponsiveTargetWidthOptions): number {
  const { desktop, mobilePortrait, phoneMaxWidth } = options
  const read = useCallback(
    () => computeResponsiveTargetWidth({ desktop, mobilePortrait, phoneMaxWidth }),
    [desktop, mobilePortrait, phoneMaxWidth],
  )
  return useSyncExternalStore(subscribeToViewport, read, () => desktop)
}
