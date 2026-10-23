// Model files are modules of the game code (vite/contentAssetsPlugin.mjs): the default export is the asset's handle.
declare module '*.glb' {
  const asset: import('./shared/engine/content').ContentAssetRef;
  export default asset;
}
declare module '*.gltf' {
  const asset: import('./shared/engine/content').ContentAssetRef;
  export default asset;
}
declare module '*.fbx' {
  const asset: import('./shared/engine/content').ContentAssetRef;
  export default asset;
}
