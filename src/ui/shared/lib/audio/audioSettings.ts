import { useSyncExternalStore } from 'react'

import { setChannelVolume, setMasterVolume, setSoundMuted } from './soundMixer'
import type { SoundChannel } from './soundMixer'


export type AudioSettings = {
  readonly master: number
  readonly music: number
  readonly sfx: number
  readonly muted: boolean
}

const CHANNEL_KEYS = ['music', 'sfx'] as const satisfies readonly SoundChannel[]

export const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  master: 1,
  music: 1,
  muted: false,
  sfx: 1,
}

const STORAGE_KEY = 'web-starter-kit:audio-settings:v1'

function clamp01(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1
}

function readInitialSettings(): AudioSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return DEFAULT_AUDIO_SETTINGS
    const parsed = JSON.parse(stored) as Partial<AudioSettings>
    return {
      master: clamp01(parsed.master ?? DEFAULT_AUDIO_SETTINGS.master),
      music: clamp01(parsed.music ?? DEFAULT_AUDIO_SETTINGS.music),
      muted: parsed.muted === true,
      sfx: clamp01(parsed.sfx ?? DEFAULT_AUDIO_SETTINGS.sfx),
    }
  } catch {
    return DEFAULT_AUDIO_SETTINGS
  }
}

let current: AudioSettings = readInitialSettings()
const listeners = new Set<() => void>()

function apply(settings: AudioSettings): void {
  setMasterVolume(settings.master)
  for (const channel of CHANNEL_KEYS) setChannelVolume(channel, settings[channel])
  setSoundMuted(settings.muted)
}

export function getAudioSettings(): AudioSettings {
  return current
}

export function setAudioSettings(patch: Partial<AudioSettings>): void {
  const next: AudioSettings = {
    master: clamp01(patch.master ?? current.master),
    music: clamp01(patch.music ?? current.music),
    muted: patch.muted ?? current.muted,
    sfx: clamp01(patch.sfx ?? current.sfx),
  }
  if (
    next.master === current.master &&
    next.music === current.music &&
    next.sfx === current.sfx &&
    next.muted === current.muted
  ) {
    return
  }

  current = next
  apply(next)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useAudioSettings(): AudioSettings {
  return useSyncExternalStore(subscribe, getAudioSettings, getAudioSettings)
}

export function initAudioSettings(): void {
  apply(current)
}

export function resetAudioSettingsForTests(): void {
  current = DEFAULT_AUDIO_SETTINGS
  apply(current)
}
