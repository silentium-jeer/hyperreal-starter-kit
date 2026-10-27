import { useCallback, useRef, useSyncExternalStore } from 'react';


type Listener = () => void;

export interface GameState<T extends object> {
  readonly state: T;
  subscribe(listener: Listener): () => void;
}

const isTracked = (value: unknown): value is object => typeof value === 'object' && value !== null;

export function createGameState<T extends object>(initial: T): GameState<T> {
  const listeners = new Set<Listener>();
  const proxies = new WeakMap<object, object>();
  let pending = false;

  const announce = () => {
    pending = false;
    for (const listener of [...listeners]) listener();
  };
  const changed = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(announce);
  };
  const track = <V extends object>(target: V): V => {
    const known = proxies.get(target);
    if (known) return known as V;
    const proxy = new Proxy(target, {
      get(object, key, receiver) {
        const value = Reflect.get(object, key, receiver);
        return isTracked(value) ? track(value) : value;
      },
      set(object, key, value) {
        const previous = Reflect.get(object, key);
        const next = isTracked(value) ? raw(value) : value;
        const stored = Reflect.set(object, key, next);
        if (previous !== next) changed();
        return stored;
      },
      deleteProperty(object, key) {
        const had = Reflect.has(object, key);
        const deleted = Reflect.deleteProperty(object, key);
        if (had) changed();
        return deleted;
      },
    });
    proxies.set(target, proxy);
    raws.set(proxy, target);
    return proxy;
  };

  return {
    state: track(initial),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

const raws = new WeakMap<object, object>();
const raw = <V extends object>(value: V): V => (raws.get(value) as V | undefined) ?? value;

export function shallowEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!isTracked(left) || !isTracked(right) || Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every((key) => Object.prototype.hasOwnProperty.call(right, key) && Object.is((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]));
}

export function useGameState<T extends object, S>(game: GameState<T>, select: (state: T) => S, equal: (left: S, right: S) => boolean = shallowEqual): S {
  const last = useRef<{ value: S } | null>(null);
  const read = useCallback(() => {
    const value = select(game.state);
    if (last.current && equal(last.current.value, value)) return last.current.value;
    last.current = { value };
    return value;
  }, [game, select, equal]);
  return useSyncExternalStore(game.subscribe, read);
}

export function saveGame<T extends object>(game: GameState<T>): string {
  return JSON.stringify(raw(game.state));
}

export function loadGame<T extends object>(game: GameState<T>, json: string): void {
  const saved = JSON.parse(json) as T;
  const state = game.state as Record<string, unknown>;
  for (const key of Object.keys(state)) if (!(key in saved)) delete state[key];
  Object.assign(state, saved);
}
