import * as UE from 'ue';
import { $ref, $unref } from 'puerts';
import { MODIFIER_KEYS, MOUSE_BUTTONS, WHEEL_KEYS, engineKeyOf } from './keys';

export type EventValue = 'PRESS' | 'RELEASE' | 'CLICK' | 'CLICK_DRAG' | 'DOUBLE_CLICK' | 'MOVE';
export type Cursor = [number, number];

export interface InputEvent {
  type: string;
  value: EventValue;
  repeat: boolean;
  shift: boolean;
  ctrl: boolean;
  alt: boolean;
  cursor?: Cursor;
  pressCursor?: Cursor;
}

const DRAG_THRESHOLD_MOUSE_PX = 3;
const DOUBLE_CLICK_MS = 350;
const REPEAT_DELAY_MS = 500;
const REPEAT_INTERVAL_MS = 1000 / 30;

interface Held {
  since: number;
  lastRepeat: number;
  pressCursor?: Cursor;
  dragged: boolean;
}

const isMouseButton = (type: string) => (MOUSE_BUTTONS as readonly string[]).includes(type);
const isWheel = (type: string) => (WHEEL_KEYS as readonly string[]).includes(type);

function cursorOf(controller: UE.PlayerController): Cursor | undefined {
  const x = $ref(0);
  const y = $ref(0);
  return controller.GetMousePosition(x, y) ? [$unref(x), $unref(y)] : undefined;
}

export function createEventSource() {
  const held = new Map<string, Held>();
  const lastClick = new Map<string, number>();
  let lastCursor: Cursor | undefined;

  return function poll(controller: UE.PlayerController, watched: Iterable<string>): InputEvent[] {
    const now = Date.now();
    const down = (type: string) => controller.IsInputKeyDown(engineKeyOf(type));
    const modifiers = {
      shift: MODIFIER_KEYS.shift.some(down),
      ctrl: MODIFIER_KEYS.ctrl.some(down),
      alt: MODIFIER_KEYS.alt.some(down),
    };
    const cursor = cursorOf(controller);
    const events: InputEvent[] = [];
    const emit = (type: string, value: EventValue, extra: Partial<InputEvent> = {}) => events.push({ type, value, repeat: false, ...modifiers, cursor, ...extra });

    if (cursor && (!lastCursor || cursor[0] !== lastCursor[0] || cursor[1] !== lastCursor[1])) emit('MOUSEMOVE', 'MOVE');
    lastCursor = cursor;

    for (const type of watched) {
      const key = engineKeyOf(type);
      if (controller.WasInputKeyJustPressed(key)) {
        emit(type, 'PRESS');
        if (isWheel(type)) continue;
        held.set(type, { since: now, lastRepeat: now, pressCursor: cursor, dragged: false });
      } else if (controller.WasInputKeyJustReleased(key) && held.has(type)) {
        const state = held.get(type)!;
        held.delete(type);
        emit(type, 'RELEASE', { pressCursor: state.pressCursor });
        if (state.dragged) continue;
        emit(type, 'CLICK', { pressCursor: state.pressCursor });
        if (now - (lastClick.get(type) ?? -Infinity) <= DOUBLE_CLICK_MS) emit(type, 'DOUBLE_CLICK', { pressCursor: state.pressCursor });
        lastClick.set(type, now);
      } else if (held.has(type)) {
        const state = held.get(type)!;
        if (isMouseButton(type) && !state.dragged && cursor && state.pressCursor) {
          if (Math.hypot(cursor[0] - state.pressCursor[0], cursor[1] - state.pressCursor[1]) >= DRAG_THRESHOLD_MOUSE_PX) {
            state.dragged = true;
            emit(type, 'CLICK_DRAG', { pressCursor: state.pressCursor });
          }
        } else if (!isMouseButton(type) && now - state.since >= REPEAT_DELAY_MS && now - state.lastRepeat >= REPEAT_INTERVAL_MS) {
          state.lastRepeat = now;
          emit(type, 'PRESS', { repeat: true });
        }
      }
    }
    return events;
  };
}

export const isHeld = (controller: UE.PlayerController, type: string) => controller.IsInputKeyDown(engineKeyOf(type));
