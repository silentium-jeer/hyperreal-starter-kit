import type { ReactElement } from 'react';
import type { MaterialProps } from '../../../../Typing/ue/ue-material-jsx';
import type { DynamicMaterial, MaterialParam, MaterialParamValues, MaterialRef, MaterialTuple, MaterialValue, ParamOptions } from './types';

export type * from './types';

// Materials written as JSX. A material module (a file named `*.material.tsx`) exports materials:
//
//   export default defineMaterial(
//     <material usage={['instancedStaticMeshes']} roughness={param('roughness', 0.4)}
//       baseColor={<multiply a={param('tint', [1, 0.3, 0.1])} b={<textureSample texture="/Engine/..." />} />} />,
//   );
//
// Elements are the engine's material expressions (UMaterialExpression<Name> as <name>), props their properties and
// inputs (generated from reflection: Typing/ue/ue-material-jsx.d.ts); <material>'s props are the material's inputs
// (baseColor, emissiveColor, ...) and settings (blendMode, shadingModel, twoSided, usage). The dev server evaluates the
// module, the content service builds each export into a material asset, the cook compiles its shaders, and the game
// gets a handle that goes where a material prop goes: <staticMeshComponent overrideMaterials={[lava]} />. Saving the
// module puts the new material on every mesh that uses it in the running game.

// Definitions as the dev server sees them when it evaluates a material module (content/materials.mjs). The game never
// evaluates a material module: it imports a handle in its place (vite/materialAssetsPlugin.mjs).
export interface MaterialDefinition {
  readonly kind: 'material-definition';
  readonly element: ReactElement;
}
export interface InstanceDefinition {
  readonly kind: 'instance-definition';
  readonly base: MaterialDefinition;
  readonly params: MaterialParamValues;
}

// A material from its <material> element. Typed as the handle the game imports in its place.
export function defineMaterial(element: ReactElement<MaterialProps>): MaterialRef {
  const definition: MaterialDefinition = { kind: 'material-definition', element };
  return definition as unknown as MaterialRef;
}

// A saved instance (UMaterialInstanceConstant) of a material: parameter values only, so it shares the material's
// shaders and its build compiles none.
export function defineInstance(base: MaterialRef, params: MaterialParamValues): MaterialRef {
  const definition: InstanceDefinition = { kind: 'instance-definition', base: base as unknown as MaterialDefinition, params };
  return definition as unknown as MaterialRef;
}

// A material parameter: a scalar (a number), a vector (a tuple) or a texture (an object path) with its default value.
// The same name used twice is one parameter.
export function param(name: string, value: number, options?: ParamOptions): MaterialParam;
export function param(name: string, value: MaterialTuple, options?: Omit<ParamOptions, 'sliderMin' | 'sliderMax'>): MaterialParam;
export function param(name: string, texture: string, options?: Omit<ParamOptions, 'sliderMin' | 'sliderMax'>): MaterialParam;
export function param(name: string, value: number | MaterialTuple | string, options?: ParamOptions): MaterialParam {
  return { kind: 'param', name, value, options };
}

// A dynamic instance of a material, made in the game (UMaterialInstanceDynamic) where it is used:
// overrideMaterials={[instance(lava, { tint: [0.2, 0.6, 1] })]}. New values apply at once, with no cook.
export function instance(base: MaterialRef, params: MaterialParamValues): DynamicMaterial {
  return { kind: 'dynamic', base, params };
}

export const isMaterialValue = (value: unknown): value is MaterialValue =>
  typeof value === 'object' && value !== null && ((value as any).kind === 'dynamic' ? typeof (value as any).base?.key === 'string' : ((value as any).kind === 'material' || (value as any).kind === 'instance') && typeof (value as any).key === 'string');
