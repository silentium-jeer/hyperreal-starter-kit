import type * as UE from 'ue';
import { createEventSource, type EventValue, type InputEvent } from './events';
import { ALL_KEY_TYPES, MODIFIER_KEYS, MOUSE_BUTTONS, isKnownKey, keyLabel } from './keys';

export type BindingValue = Exclude<EventValue, 'MOVE'> | 'ANY';

export interface Binding {
  type: string;
  value: BindingValue;
  shift?: boolean;
  ctrl?: boolean;
  alt?: boolean;
  any?: boolean;
  repeat?: boolean;
}

export type ModalResult = 'running' | 'finished' | 'cancelled' | 'pass';

export interface ModalOperation {
  keymap: string;
  modal(action: string | undefined, event: InputEvent): ModalResult;
  status?(): string;
}

export type BindingResult = ModalOperation | 'pass' | void;

export interface LayerBinding {
  binding: Binding;
  label: string;
  run(event: InputEvent): BindingResult;
}

export interface Layer {
  name: string;
  depth: number;
  order: number;
  exclusive: boolean;
  bindings: Set<LayerBinding>;
}

export interface ModalKeymap {
  name: string;
  actions: Record<string, string>;
  items: { action: string; binding: Binding }[];
}

export interface BindingOverride {
  layer: string;
  label: string;
  binding?: Binding;
  disabled?: boolean;
}

const layers = new Set<Layer>();
const modalKeymaps = new Map<string, ModalKeymap>();
let overrides: BindingOverride[] = [];
const modalStack: ModalOperation[] = [];
let clickConsumedBy: string | undefined;
let nextOrder = 0;

export const defineModalKeymap = (keymap: ModalKeymap) => void modalKeymaps.set(keymap.name, keymap);
export const setBindingOverrides = (next: BindingOverride[]) => void (overrides = next);
export const runningModal = () => modalStack.at(-1);

export function mountLayer(layer: Layer) {
  layer.order = ++nextOrder;
  layers.add(layer);
  return () => {
    layers.delete(layer);
  };
}

export function activeLayers() {
  const sorted = [...layers].sort((a, b) => b.depth - a.depth || b.order - a.order);
  const exclusive = sorted.findIndex((layer) => layer.exclusive);
  return exclusive >= 0 ? sorted.slice(0, exclusive + 1) : sorted;
}

function bindingsOf(layer: Layer) {
  return [...layer.bindings].flatMap((entry) => {
    const override = overrides.find((candidate) => candidate.layer === layer.name && candidate.label === entry.label);
    if (override?.disabled) return [];
    return [override?.binding ? { ...entry, binding: override.binding } : entry];
  });
}

function matches(binding: Binding, event: InputEvent) {
  if (binding.type !== event.type) return false;
  if (binding.value !== 'ANY' && binding.value !== event.value) return false;
  if (event.repeat && !binding.repeat) return false;
  if (binding.any) return true;
  return Boolean(binding.shift) === event.shift && Boolean(binding.ctrl) === event.ctrl && Boolean(binding.alt) === event.alt;
}

function watchedKeys() {
  const watched = new Set<string>([...MOUSE_BUTTONS, ...MODIFIER_KEYS.shift, ...MODIFIER_KEYS.ctrl, ...MODIFIER_KEYS.alt]);
  for (const layer of activeLayers()) for (const entry of bindingsOf(layer)) if (isKnownKey(entry.binding.type)) watched.add(entry.binding.type);
  if (modalStack.length) for (const type of ALL_KEY_TYPES) watched.add(type);
  return watched;
}

function dispatchToModal(event: InputEvent) {
  const modal = runningModal();
  if (!modal) return false;
  const action = modalKeymaps.get(modal.keymap)?.items.find((item) => matches(item.binding, event))?.action;
  const result = modal.modal(action, event);
  if (result === 'pass') return false;
  if (result !== 'running') {
    modalStack.splice(modalStack.indexOf(modal), 1);
    if (event.value === 'RELEASE') clickConsumedBy = event.type;
  }
  return true;
}

function dispatchToLayers(event: InputEvent) {
  for (const layer of activeLayers()) {
    for (const entry of bindingsOf(layer)) {
      if (!matches(entry.binding, event)) continue;
      const result = entry.run(event);
      if (result === 'pass') continue;
      if (result) modalStack.push(result);
      return true;
    }
  }
  return false;
}

export function dispatch(event: InputEvent) {
  if (event.value === 'PRESS') clickConsumedBy = undefined;
  if (clickConsumedBy === event.type && (event.value === 'CLICK' || event.value === 'DOUBLE_CLICK')) return true;
  return dispatchToModal(event) || dispatchToLayers(event);
}

const pollEvents = createEventSource();

export function processInput(controller: UE.PlayerController) {
  for (const event of pollEvents(controller, watchedKeys())) dispatch(event);
}

export function cancelModals() {
  for (const modal of [...modalStack].reverse()) modal.modal('CANCEL', { type: 'ESC', value: 'PRESS', repeat: false, shift: false, ctrl: false, alt: false });
  modalStack.length = 0;
}

const VALUE_LABELS: Partial<Record<BindingValue, string>> = { CLICK_DRAG: 'Drag', DOUBLE_CLICK: 'Double', RELEASE: 'Release' };

export function bindingLabel(binding: Binding) {
  const parts = [binding.ctrl && 'Ctrl', binding.shift && 'Shift', binding.alt && 'Alt', keyLabel(binding.type), VALUE_LABELS[binding.value]];
  return parts.filter(Boolean).join(' ');
}

export interface BindingHint {
  label: string;
  keys: string[];
}

export function describeContext(): { title: string; hints: BindingHint[]; status?: string }[] {
  const modal = runningModal();
  if (modal) {
    const keymap = modalKeymaps.get(modal.keymap);
    const hints = (keymap?.items ?? []).map((item) => ({ label: keymap!.actions[item.action] ?? item.action, keys: [bindingLabel(item.binding)] }));
    return [{ title: modal.keymap, hints, status: modal.status?.() }];
  }
  return activeLayers().map((layer) => ({ title: layer.name, hints: bindingsOf(layer).map((entry) => ({ label: entry.label, keys: [bindingLabel(entry.binding)] })) }));
}
