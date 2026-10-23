// Types the web-starter-kit UI kit expects from its own Vite setup (web-starter-kit src/vite-env.d.ts),
// provided here so the copied kit folders (features/, shared/) stay byte-for-byte unchanged.

// Baked in by the dev server (server.mjs `define`): the shell's lab index and UI-kit gallery exist in dev only.
declare const __SHOWCASE_SURFACES__: boolean

// Served by the kit's bootstrapAssetRegistryPlugin (dev/vite/bootstrapAssetRegistryPlugin.ts, wired in
// server.mjs for the client environment); features/bootstrap/systems/bootstrapAssetRegistry.ts imports it.
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
