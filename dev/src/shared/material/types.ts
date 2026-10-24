import type { Key, ReactElement } from 'react';

// Types of material descriptions (`*.material.tsx` modules) and of the handles the game gets for them. The element
// props themselves are generated from the engine's reflection (Typing/ue/ue-material-jsx.d.ts, VgeJsxDeclarations.cpp).

// A vector value: [r, g], [r, g, b] or [r, g, b, a].
export type MaterialTuple = readonly number[];

export interface ParamOptions {
  group?: string;
  sortPriority?: number;
  // Scalar parameters: the range the editor's slider shows.
  sliderMin?: number;
  sliderMax?: number;
}

// A material parameter (param()): a scalar (number), a vector (tuple) or a texture (object path), whose value an
// instance sets.
export interface MaterialParam {
  readonly kind: 'param';
  readonly name: string;
  readonly value: number | MaterialTuple | string;
  readonly options?: ParamOptions;
}

// What an input takes: a constant, a parameter, an expression element, or nothing (left unconnected).
export type MaterialInput = number | MaterialTuple | MaterialParam | ReactElement | null | undefined | false;

export interface MaterialElement {
  key?: Key;
  // Which output of the expression an input takes ("R", "RGB", a named output such as a Custom expression's extra
  // output); the first output when not given.
  output?: string;
}

export interface MaterialRootElement {
  key?: Key;
}

export type MaterialParamType = 'scalar' | 'vector' | 'texture';
export type MaterialParamValue = number | MaterialTuple | string;
export type MaterialParamValues = Readonly<Record<string, MaterialParamValue>>;

// The handle of an exported material or saved instance (the default and named exports of a material module, as the
// game imports them). A prop that takes a material takes it: overrideMaterials={[lava]}.
export interface MaterialRef {
  readonly kind: 'material' | 'instance';
  // "<module path relative to dev>#<export name>"
  readonly key: string;
  // Release build only: the cooked asset's object path.
  readonly path?: string;
  readonly usage: readonly string[];
  readonly params: Readonly<Record<string, MaterialParamType>>;
}

// A dynamic instance of a material, made in the game (UMaterialInstanceDynamic): its parameter values change with no
// cook and no shader compilation.
export interface DynamicMaterial {
  readonly kind: 'dynamic';
  readonly base: MaterialRef;
  readonly params: MaterialParamValues;
}

export type MaterialValue = MaterialRef | DynamicMaterial;
