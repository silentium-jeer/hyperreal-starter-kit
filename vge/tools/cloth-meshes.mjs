import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Document, NodeIO } from '@gltf-transform/core';

const outDir = join(import.meta.dirname, '../../src/features/world/assets/cloth');

function grid({ columns, rows, corner, across, down }) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column <= columns; column++) {
      const u = column / columns;
      const v = row / rows;
      positions.push(corner[0] + across[0] * u + down[0] * v, corner[1] + across[1] * u + down[1] * v, corner[2] + across[2] * u + down[2] * v);
      uvs.push(u, v);
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  return { positions, uvs, indices };
}

function cylinder({ radius, height, segments }) {
  const positions = [];
  const indices = [];
  for (let segment = 0; segment <= segments; segment++) {
    const angle = (segment / segments) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    positions.push(x, 0, z, x, height, z);
  }
  for (let segment = 0; segment < segments; segment++) {
    const a = segment * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return { positions, indices };
}

function railOf(length, height) {
  const { positions, indices } = cylinder({ radius: 0.025, height: length, segments: 12 });
  const turned = [];
  for (let index = 0; index < positions.length; index += 3) turned.push(positions[index + 1] - length / 2, height + positions[index], positions[index + 2]);
  return { positions: turned, indices };
}

function skinnedModel(name, parts) {
  const document = new Document();
  const buffer = document.createBuffer();
  const scene = document.createScene(name);
  const root = document.createNode('root');
  const skin = document.createSkin('skin').addJoint(root);
  skin.setInverseBindMatrices(document.createAccessor().setType('MAT4').setArray(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])).setBuffer(buffer));
  const mesh = document.createMesh(name);
  for (const part of parts) {
    const count = part.positions.length / 3;
    const material = document.createMaterial(part.material).setBaseColorFactor(part.color).setRoughnessFactor(part.roughness).setMetallicFactor(part.metallic ?? 0).setDoubleSided(true);
    const primitive = document.createPrimitive()
      .setMaterial(material)
      .setIndices(document.createAccessor().setType('SCALAR').setArray(new Uint32Array(part.indices)).setBuffer(buffer))
      .setAttribute('POSITION', document.createAccessor().setType('VEC3').setArray(new Float32Array(part.positions)).setBuffer(buffer))
      .setAttribute('COLOR_0', document.createAccessor().setType('VEC4').setArray(new Float32Array(count * 4).fill(1)).setBuffer(buffer));
    if (part.uvs) primitive.setAttribute('TEXCOORD_0', document.createAccessor().setType('VEC2').setArray(new Float32Array(part.uvs)).setBuffer(buffer));
    mesh.addPrimitive(primitive
      .setAttribute('JOINTS_0', document.createAccessor().setType('VEC4').setArray(new Uint16Array(count * 4)).setBuffer(buffer))
      .setAttribute('WEIGHTS_0', document.createAccessor().setType('VEC4').setArray(new Float32Array(Array.from({ length: count }, () => [1, 0, 0, 0]).flat())).setBuffer(buffer)));
  }
  const body = document.createNode(name).setMesh(mesh).setSkin(skin);
  scene.addChild(root).addChild(body);
  return document;
}

const flag = skinnedModel('Flag', [
  { material: 'Pole', color: [0.55, 0.56, 0.58, 1], roughness: 0.35, metallic: 1, ...cylinder({ radius: 0.035, height: 4.2, segments: 16 }) },
  { material: 'Cloth', color: [0.75, 0.08, 0.06, 1], roughness: 0.85, ...grid({ columns: 48, rows: 30, corner: [0.035, 4.1, 0], across: [1.6, 0, 0], down: [0, -1, 0] }) },
]);

const curtain = skinnedModel('Curtain', [
  { material: 'Rail', color: [0.12, 0.1, 0.09, 1], roughness: 0.5, metallic: 0.6, ...railOf(3.2, 2.6) },
  { material: 'Cloth', color: [0.18, 0.22, 0.42, 1], roughness: 0.9, ...panels([
    grid({ columns: 30, rows: 46, corner: [-1.5, 2.55, 0], across: [1.49, 0, 0], down: [0, -2.4, 0] }),
    grid({ columns: 30, rows: 46, corner: [0.01, 2.55, 0], across: [1.49, 0, 0], down: [0, -2.4, 0] }),
  ]) },
]);

function panels(parts) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (const part of parts) {
    const offset = positions.length / 3;
    positions.push(...part.positions);
    uvs.push(...part.uvs);
    indices.push(...part.indices.map((index) => index + offset));
  }
  return { positions, uvs, indices };
}

const cape = skinnedModel('Cape', [
  { material: 'Cloth', color: [0.35, 0.03, 0.05, 1], roughness: 0.8, ...grid({ columns: 24, rows: 40, corner: [-0.3, 0, 0], across: [0.6, 0, 0], down: [0, -1.15, 0] }) },
]);

mkdirSync(outDir, { recursive: true });
const io = new NodeIO();
await io.write(join(outDir, 'flag.glb'), flag);
await io.write(join(outDir, 'curtain.glb'), curtain);
await io.write(join(outDir, 'cape.glb'), cape);
console.log(`wrote flag.glb, curtain.glb and cape.glb to ${outDir}`);
