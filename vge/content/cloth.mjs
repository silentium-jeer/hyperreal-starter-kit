import { existsSync, readFileSync, statSync } from 'node:fs';

export const CLOTH_SUFFIX = '.cloth.json';

export const clothFileOf = (model) => model.replace(/\.[^.\\/]+$/, CLOTH_SUFFIX);

export const modelsOfClothFile = (file) => ['.glb', '.gltf', '.fbx'].map((extension) => file.slice(0, -CLOTH_SUFFIX.length) + extension);

export function clothOf(model) {
  const file = clothFileOf(model);
  if (!existsSync(file)) return undefined;
  return { file, mtimeMs: statSync(file).mtimeMs, description: JSON.parse(readFileSync(file, 'utf8')) };
}
