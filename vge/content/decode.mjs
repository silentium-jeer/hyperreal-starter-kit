// Rewrites a model file into what Interchange's glTF translator in 5.8 reads, shared by the dev content
// pipeline and the release build:
// - data in extensions Interchange cannot decode (meshopt, Draco, quantization, WebP/AVIF) becomes plain glTF/PNG;
// - ':' leaves node names (Mixamo's FBX-to-glTF exports keep "mixamorig:Hips", three.js-era exports have
//   "mixamorigHips"), so files from both sources name the same bones the same way.
// Other formats (.fbx) are imported as they are.
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dequantize, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const COMPRESSION_EXTENSIONS = ['EXT_meshopt_compression', 'KHR_draco_mesh_compression', 'KHR_mesh_quantization'];
const TEXTURE_EXTENSIONS = ['EXT_texture_webp', 'EXT_texture_avif'];
const GLTF = /\.(glb|gltf)$/i;

export function createDecoder() {
  let io;
  async function getIO() {
    if (!io) {
      await MeshoptDecoder.ready;
      io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
        'meshopt.decoder': MeshoptDecoder,
        'draco3d.decoder': await draco3d.createDecoderModule(),
      });
    }
    return io;
  }

  // Returns the file to import (`source` itself when nothing had to change, else `target`) and what was rewritten.
  return async function decode(source, target) {
    if (!GLTF.test(source)) return { file: source, decoded: [] };
    const gltfIO = await getIO();
    const document = await gltfIO.read(source);
    const root = document.getRoot();
    const used = root.listExtensionsUsed().map((e) => e.extensionName);
    const unsupported = used.filter((name) => COMPRESSION_EXTENSIONS.includes(name) || TEXTURE_EXTENSIONS.includes(name));
    const decoded = [...unsupported];

    if (root.listNodes().some((node) => node.getName().includes(':'))) {
      for (const node of root.listNodes()) node.setName(node.getName().replaceAll(':', ''));
      decoded.push('node-names');
    }
    if (decoded.length === 0) return { file: source, decoded };

    if (unsupported.length > 0) {
      const transforms = [dequantize()];
      if (unsupported.some((name) => TEXTURE_EXTENSIONS.includes(name))) {
        transforms.push(textureCompress({ encoder: sharp, targetFormat: 'png', pattern: /.*/ }));
      }
      await document.transform(...transforms);
      for (const extension of root.listExtensionsUsed()) {
        if (unsupported.includes(extension.extensionName)) extension.dispose();
      }
    }
    await gltfIO.write(target, document);
    return { file: target, decoded };
  };
}

// The content-path name of a model file: flight-case.glb -> FlightCase.
export const assetName = (file) =>
  file
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toUpperCase());
