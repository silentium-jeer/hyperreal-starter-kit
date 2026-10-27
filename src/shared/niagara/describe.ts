import { describeInstance, describeMaterial, hashOf, type MaterialAsset } from '../material/describe';
import type { NiagaraSystemDefinition, NiagaraSystemDescription, NiagaraUserValue } from './index';


export interface NiagaraExport {
  exportName: string;
  exportKey: string;
  folder: string;
  name: string;
  path: string;
  user: Record<string, 'float' | 'bool' | 'vector' | 'color'>;
  description: NiagaraSystemDescription;
  materials: MaterialAsset[];
}

const FORMAT = 2;

const isSystem = (value: unknown): value is NiagaraSystemDefinition => (value as any)?.kind === 'niagara-definition';
const isMaterial = (value: unknown) => (value as any)?.kind === 'material-definition';
const isInstance = (value: unknown) => (value as any)?.kind === 'instance-definition';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const niagaraModuleName = (fileKey: string) =>
  fileKey
    .replace(/^.*\//, '')
    .replace(/\.niagara\.[jt]sx?$/, '')
    .replace(/[^A-Za-z0-9]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ''))
    .replace(/^./, (c) => c.toUpperCase());

const exportAssetName = (fileKey: string, exportName: string) =>
  exportName === 'default' ? niagaraModuleName(fileKey) : `${niagaraModuleName(fileKey)}_${capitalize(exportName.replace(/[^A-Za-z0-9]/g, ''))}`;

function userType(name: string, value: NiagaraUserValue) {
  if (typeof value === 'number') return 'float';
  if (typeof value === 'boolean') return 'bool';
  if (Array.isArray(value) && value.length === 3) return 'vector';
  if (Array.isArray(value) && value.length === 4) return 'color';
  throw new Error(`the user parameter '${name}' is a number, a boolean, a 3-tuple (vector) or a 4-tuple (color)`);
}

export function describeModule(fileKey: string, moduleExports: Record<string, unknown>, folderRoot: string, materialRoot: string, names: WeakMap<object, string>): NiagaraExport[] {
  const result: NiagaraExport[] = [];
  for (const [exportName, value] of Object.entries(moduleExports)) {
    if (!isSystem(value)) continue;
    const exportKey = `${fileKey}#${exportName}`;
    try {
      const materials: MaterialAsset[] = [];
      const materialPath = (material: unknown, where: string) => {
        if (typeof material === 'string') return material;
        if (isMaterial(material)) {
          const name = names.get(material as object);
          if (!name) throw new Error(`${where}: the material is not exported by a material module`);
          const asset = describeMaterial(material as any, materialRoot, name);
          materials.push(asset);
          return asset.path;
        }
        if (isInstance(material)) {
          const base = (material as any).base;
          const baseName = names.get(base);
          const name = names.get(material as object);
          if (!baseName || !name) throw new Error(`${where}: the material instance is not exported by a material module`);
          const baseAsset = describeMaterial(base, materialRoot, baseName);
          const asset = describeInstance(material as any, baseAsset, materialRoot, name);
          materials.push(baseAsset, asset);
          return asset.path;
        }
        throw new Error(`${where}: a material is a material module's export or an asset path`);
      };
      const { user = {}, emitters, template } = value.description;
      if (!emitters || !Object.keys(emitters).length) throw new Error('a system has at least one emitter');
      const description: NiagaraSystemDescription = {
        ...(template ? { template } : {}),
        user,
        emitters: Object.fromEntries(
          Object.entries(emitters).map(([emitterName, emitter]) => [
            emitterName,
            {
              ...emitter,
              renderers: emitter.renderers?.map((renderer, index) => ({
                ...renderer,
                material: renderer.material === undefined ? undefined : materialPath(renderer.material, `${emitterName}.renderers[${index}].material`),
              })),
            },
          ]),
        ),
      };
      const name = exportAssetName(fileKey, exportName);
      const folder = `${folderRoot}/${name}_${hashOf(JSON.stringify([FORMAT, name, description]))}`;
      result.push({
        exportName,
        exportKey,
        folder,
        name,
        path: `${folder}/${name}.${name}`,
        user: Object.fromEntries(Object.entries(user).map(([param, v]) => [param, userType(param, v)])),
        description,
        materials,
      });
    } catch (err: any) {
      throw new Error(`${exportKey}: ${err?.message ?? err}`);
    }
  }
  return result;
}
