
declare const __SHOWCASE_SURFACES__: boolean

declare module 'virtual:bootstrap-assets' {
  export type BootstrapAssetEntry = {
    deferred: boolean
    id: string
    kind: 'audio' | 'font' | 'image' | 'model' | 'other'
    size: number
    source: string
    url: string
  }

  export const bootstrapAssetEntries: BootstrapAssetEntry[]
}
