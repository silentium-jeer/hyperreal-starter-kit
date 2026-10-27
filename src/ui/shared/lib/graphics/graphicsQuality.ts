import { useSyncExternalStore } from 'react'

import {
  DEFAULT_GRAPHICS_QUALITY,
  GRAPHICS_PRESETS,
  type GraphicsPreset,
  type GraphicsQuality,
} from '../../config/graphicsPresets'

const STORAGE_KEY = 'web-starter-kit:graphics-quality:v1'

function isGraphicsQuality(value: string | null | undefined): value is GraphicsQuality {
  return value === 'performance' || value === 'economy'
}

function readInitialQuality(): GraphicsQuality {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (isGraphicsQuality(stored)) {
      return stored
    }
  } catch {
  }

  return DEFAULT_GRAPHICS_QUALITY
}

let currentQuality: GraphicsQuality = readInitialQuality()
const listeners = new Set<() => void>()

function getGraphicsQuality(): GraphicsQuality {
  return currentQuality
}

export function setGraphicsQuality(next: GraphicsQuality): void {
  if (next === currentQuality) {
    return
  }

  currentQuality = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
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

export function useGraphicsQuality(): GraphicsQuality {
  return useSyncExternalStore(subscribe, getGraphicsQuality, getGraphicsQuality)
}

export function useGraphicsSettings(): GraphicsPreset {
  return GRAPHICS_PRESETS[useGraphicsQuality()]
}
