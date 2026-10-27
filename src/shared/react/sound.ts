import type { ContentAssetRef } from '../engine/content';
import { playSound, type SoundOptions } from '../engine/sound';
import { useContentAsset } from './content';

export function useSound(ref: ContentAssetRef) {
  const asset = useContentAsset(ref);
  return { ready: Boolean(asset?.sounds.length), play: (options?: SoundOptions) => (asset ? playSound(asset, options) : undefined) };
}
