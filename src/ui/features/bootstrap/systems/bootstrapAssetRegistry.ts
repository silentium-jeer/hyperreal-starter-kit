import {
  bootstrapAssetEntries,
  type BootstrapAssetEntry,
} from 'virtual:bootstrap-assets'

export type BootstrapAsset = BootstrapAssetEntry

export function getBlockingBootstrapAssets(): BootstrapAsset[] {
  return bootstrapAssetEntries.filter((asset) => !asset.deferred)
}

export function getBootstrapAssetWeight(asset: BootstrapAsset): number {
  return Math.max(1, Math.round(asset.size / 8192))
}
