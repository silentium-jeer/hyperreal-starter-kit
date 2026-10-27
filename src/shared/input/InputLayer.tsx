import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { InputEvent } from './events';
import { mountLayer, type Binding, type BindingResult, type BindingValue, type Layer } from './keymap';

const LayerContext = createContext<Layer | null>(null);

const KEY_ALIASES: Record<string, string> = { LMB: 'LEFTMOUSE', MMB: 'MIDDLEMOUSE', RMB: 'RIGHTMOUSE', ESCAPE: 'ESC', ENTER: 'RET', DELETE: 'DEL' };

export function parseKeys(keys: string): Pick<Binding, 'type' | 'shift' | 'ctrl' | 'alt'> {
  const parts = keys.split('+').map((part) => part.trim().toUpperCase());
  const type = parts.pop()!;
  return { type: KEY_ALIASES[type] ?? type, shift: parts.includes('SHIFT'), ctrl: parts.includes('CTRL'), alt: parts.includes('ALT') };
}

export function InputLayer({ name, exclusive = false, children }: { name: string; exclusive?: boolean; children?: ReactNode }) {
  const parent = useContext(LayerContext);
  const [layer] = useState<Layer>(() => ({ name, depth: parent ? parent.depth + 1 : 0, order: 0, exclusive, bindings: new Set() }));
  layer.name = name;
  layer.exclusive = exclusive;
  useEffect(() => mountLayer(layer), [layer]);
  return <LayerContext.Provider value={layer}>{children}</LayerContext.Provider>;
}

export interface KeyBindingProps {
  keys: string;
  label: string;
  on?: BindingValue;
  anyModifiers?: boolean;
  repeat?: boolean;
  run(event: InputEvent): BindingResult;
}

export function KeyBinding({ keys, label, on = 'PRESS', anyModifiers = false, repeat = false, run }: KeyBindingProps) {
  const layer = useContext(LayerContext);
  if (!layer) throw new Error(`<KeyBinding keys="${keys}"> must be inside an <InputLayer>`);
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    const entry = { binding: { ...parseKeys(keys), value: on, any: anyModifiers, repeat }, label, run: (event: InputEvent) => latest.current(event) };
    layer.bindings.add(entry);
    return () => {
      layer.bindings.delete(entry);
    };
  }, [layer, keys, label, on, anyModifiers, repeat]);
  return null;
}
