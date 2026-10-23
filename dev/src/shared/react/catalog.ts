import catalogJson from '../../../../Typing/ue/ue-jsx.json';

// The generated runtime half of the JSX surface (VgeJsxDeclarations.cpp): per class, its parent and per prop
// [property name, kind, setter?]. Kinds: value, struct:<Name>, object, array, component, event.
export type PropInfo = readonly [property: string, kind: string, setter?: string];

interface ClassEntry {
  parent?: string;
  props: Record<string, PropInfo>;
}

const entries = catalogJson as unknown as Record<string, ClassEntry>;
const resolved = new Map<string, Record<string, PropInfo>>();

export const isElementClass = (className: string) => className in entries;

// Every prop of a class, its ancestors' included.
export function propsOf(className: string): Record<string, PropInfo> {
  const cached = resolved.get(className);
  if (cached) return cached;
  const entry = entries[className];
  const props = entry ? { ...(entry.parent ? propsOf(entry.parent) : {}), ...entry.props } : {};
  resolved.set(className, props);
  return props;
}

export const classNameOf = (elementType: string) => elementType.charAt(0).toUpperCase() + elementType.slice(1);

export function isA(className: string, ancestor: string): boolean {
  for (let name: string | undefined = className; name; name = entries[name]?.parent) if (name === ancestor) return true;
  return false;
}
