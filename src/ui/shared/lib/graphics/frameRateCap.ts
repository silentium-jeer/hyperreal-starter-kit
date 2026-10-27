import { useSyncExternalStore } from 'react'

import { DEFAULT_FRAME_RATE_CAP, type FrameRateCap } from '../../config/graphicsPresets'

const STORAGE_KEY = 'web-starter-kit:frame-cap:v1'

function isFrameRateCap(value: number): value is FrameRateCap {
  return value === 0 || value === 30 || value === 45 || value === 60 || value === 120
}

function readInitialCap(): FrameRateCap {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY))
    if (Number.isFinite(stored) && isFrameRateCap(stored)) {
      return stored
    }
  } catch {
  }

  return DEFAULT_FRAME_RATE_CAP
}

let currentCap: FrameRateCap = readInitialCap()
const listeners = new Set<() => void>()

function getFrameRateCap(): FrameRateCap {
  return currentCap
}

export function setFrameRateCap(next: FrameRateCap): void {
  if (next === currentCap) {
    return
  }

  currentCap = next
  try {
    window.localStorage.setItem(STORAGE_KEY, String(next))
  } catch {
  }

  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFrameRateCap(): FrameRateCap {
  return useSyncExternalStore(subscribe, getFrameRateCap, getFrameRateCap)
}
