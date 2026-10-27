import { Howler } from 'howler'


export type SoundChannel = 'sfx' | 'music' | 'ambient' | 'ui'

const channelGain: Record<SoundChannel, number> = {
  sfx: 1,
  music: 1,
  ambient: 1,
  ui: 1,
}

let isMuted = false
let masterGain = 1

export function warmSoundMixer(): void {
  const ctx = Howler.ctx
  if (ctx && ctx.state === 'suspended') {
    void ctx.resume()
  }
}

export function setSoundMuted(muted: boolean): void {
  isMuted = muted
  Howler.mute(muted)
}

export function setMasterVolume(gain: number): void {
  masterGain = clamp01(gain)
  Howler.volume(masterGain)
}

export function setChannelVolume(channel: SoundChannel, gain: number): void {
  channelGain[channel] = clamp01(gain)
}

export function getChannelGain(channel: SoundChannel): number {
  return channelGain[channel]
}

export function isSoundMuted(): boolean {
  return isMuted
}

export function decibelsToGain(decibels: number): number {
  return 10 ** (decibels / 20)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

export function resetSoundMixerForTests(): void {
  isMuted = false
  masterGain = 1
  channelGain.sfx = 1
  channelGain.music = 1
  channelGain.ambient = 1
  channelGain.ui = 1
  Howler.mute(false)
  Howler.volume(1)
}
