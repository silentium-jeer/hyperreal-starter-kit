import * as UE from 'ue';
import { loadContent, type ContentAsset } from './content';
import { gameInstance, world } from './world';

export type Vector3 = readonly [number, number, number];

export interface SoundOptions {
  at?: Vector3;
  attachTo?: UE.SceneComponent;
  volume?: number;
  pitch?: number;
  startTime?: number;
  falloffCm?: number;
}

const attenuations = new Map<number, UE.SoundAttenuation>();

function attenuationFor(falloffCm: number) {
  const known = attenuations.get(falloffCm);
  if (known) return known;
  const attenuation = new UE.SoundAttenuation(gameInstance);
  attenuation.Attenuation.bAttenuate = true;
  attenuation.Attenuation.bSpatialize = true;
  attenuation.Attenuation.FalloffDistance = falloffCm;
  attenuations.set(falloffCm, attenuation);
  return attenuation;
}

export function soundOf(asset: ContentAsset) {
  const path = asset.sounds[0];
  return path ? loadContent<UE.SoundWave>(path) : undefined;
}

export function playSound(asset: ContentAsset, options: SoundOptions = {}) {
  const sound = soundOf(asset);
  if (!sound) return undefined;
  const { volume = 1, pitch = 1, startTime = 0, falloffCm = 3600 } = options;
  if (options.attachTo) {
    return UE.GameplayStatics.SpawnSoundAttached(sound, options.attachTo, 'None', new UE.Vector(0, 0, 0), new UE.Rotator(0, 0, 0), UE.EAttachLocation.KeepRelativeOffset, true, volume, pitch, startTime, attenuationFor(falloffCm));
  }
  if (options.at) {
    return UE.GameplayStatics.SpawnSoundAtLocation(world, sound, new UE.Vector(...options.at), new UE.Rotator(0, 0, 0), volume, pitch, startTime, attenuationFor(falloffCm));
  }
  return UE.GameplayStatics.SpawnSound2D(world, sound, volume, pitch, startTime);
}
