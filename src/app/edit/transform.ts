import * as UE from 'ue';
import { world } from '../../shared/engine/world';
import { defineModalKeymap, digitOf, type Binding, type Cursor, type InputEvent, type ModalOperation, type ModalResult } from '../../shared/input';
import { activeSelected, editState, report, type Selected } from './editState';
import { add, closestParameterOnAxis, cross, dot, intersectPlane, length, normalize, scale, sub, type Vec2, type Vec3 } from './gizmoMath';
import type { TransformMode } from './gizmoParts';
import { centimetresPerPixel, toVec3, toVector, viewFrameOf, WORLD_AXES, type ViewFrame } from './gizmoView';
import { addLocationDelta, commitPlan, previewPlan, resetPlan, revertPlan, scaleBy, setWorldRotation, worldLocationOf, worldTransformOf, type Plan } from './propPlan';

const PRECISION_FACTOR = { translate: 0.1, rotate: 1 / 30, resize: 0.1, trackball: 1 / 30 };
const TRACKBALL_RADIANS_PER_PIXEL = 0.01;
const INCREMENT = { translate: 100, rotate: 5, resize: 0.1, trackball: 5 };
const PRECISION_INCREMENT = { translate: 10, rotate: 1, resize: 0.01, trackball: 1 };
const AXIS_NAMES = ['X', 'Y', 'Z'];
const MIN_SCALE_RATIO = 1e-3;
const VIEW_PARALLEL_RADIANS = (5 * Math.PI) / 180;
const CM_PER_METRE = 100;

type Orientation = 'Global' | 'Local';

interface Constraint {
  axes: [boolean, boolean, boolean];
  orientation: Orientation;
}

interface TransformStart {
  mode: TransformMode;
  constraint?: [boolean, boolean, boolean];
  releaseConfirm?: boolean;
  cursor: Cursor;
}

const controller = () => UE.GameplayStatics.GetPlayerController(world, 0) as UE.PlayerController;

function axisVectors(orientation: Orientation): Vec3[] {
  const active = activeSelected();
  if (orientation === 'Global' || !active) return WORLD_AXES;
  const rotation = worldTransformOf(active.node)?.Rotator() ?? new UE.Rotator(0, 0, 0);
  return [UE.KismetMathLibrary.GetForwardVector(rotation), UE.KismetMathLibrary.GetRightVector(rotation), UE.KismetMathLibrary.GetUpVector(rotation)].map(toVec3);
}

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

function screenAngle(centre: Vec2, point: Vec2) {
  return Math.atan2(point[1] - centre[1], point[0] - centre[0]);
}

function rotationSign(view: ViewFrame, pivot: Vec3, axis: Vec3) {
  const centre = view.project(pivot);
  const probeDirection = normalize(Math.abs(dot(axis, view.up)) < 0.9 ? sub(view.up, scale(axis, dot(view.up, axis))) : sub(view.right, scale(axis, dot(view.right, axis))));
  const probe = add(pivot, scale(probeDirection, 100));
  const turned = toVec3(UE.KismetMathLibrary.RotateAngleAxis(toVector(sub(probe, pivot)), 10, toVector(axis)));
  const [before, after] = [view.project(probe), view.project(add(pivot, turned))];
  if (!centre || !before || !after) return 1;
  let change = screenAngle(centre, after) - screenAngle(centre, before);
  if (change > Math.PI) change -= 2 * Math.PI;
  if (change < -Math.PI) change += 2 * Math.PI;
  return change >= 0 ? 1 : -1;
}

const viewVectorTo = (view: ViewFrame, point: Vec3) => normalize(sub(point, view.camera));

function axisProjection(view: ViewFrame, centre: Vec3, axis: Vec3, input: Vec3): Vec3 {
  if (length(input) < 1e-9) return [0, 0, 0];
  let angle = Math.acos(Math.max(-1, Math.min(1, dot(normalize(axis), view.forward))));
  if (angle > Math.PI / 2) angle = Math.PI - angle;
  if (angle < VIEW_PARALLEL_RADIANS) {
    let factor = (dot(view.up, input) / CM_PER_METRE) * 2;
    factor *= Math.abs(factor);
    return scale(normalize(axis), -factor * CM_PER_METRE);
  }
  const normCentre = viewVectorTo(view, centre);
  const plane = cross(normCentre, axis);
  const planeLengthSquared = dot(plane, plane);
  const along = planeLengthSquared > 1e-12 ? scale(plane, dot(input, plane) / planeLengthSquared) : ([0, 0, 0] as Vec3);
  const onAxisPlane = sub(input, along);
  const point = add(onAxisPlane, centre);
  const norm = viewVectorTo(view, point);
  if (1 - Math.abs(dot(axis, norm)) < 0.0002) return [0, 0, 0];
  const parameter = closestParameterOnAxis(centre, axis, point, norm);
  return parameter === undefined || !Number.isFinite(parameter) ? [0, 0, 0] : scale(axis, parameter);
}

function planeProjection(view: ViewFrame, centre: Vec3, normal: Vec3, input: Vec3): Vec3 {
  const position = add(input, centre);
  const viewVector = viewVectorTo(view, position);
  const onPlane = intersectPlane(position, viewVector, centre, normal);
  return onPlane ? sub(onPlane, centre) : input;
}

class Transform implements ModalOperation {
  keymap = 'Transform Modal Map';
  mode: TransformMode;
  constraint?: Constraint;
  releaseConfirm: boolean;
  startCursor: Cursor;
  virtualCursor: Cursor;
  lastCursor: Cursor;
  precision = false;
  snapInvert = false;
  numeric = '';
  numericAxis = 0;
  angle = 0;
  lastAngle = 0;
  pivot: Vec3;
  starts: { selected: Selected; location: Vec3; rotation: UE.Rotator }[];
  plan: Plan = new Map();
  problem?: string;

  constructor({ mode, constraint, releaseConfirm = false, cursor }: TransformStart) {
    this.mode = mode;
    this.constraint = constraint ? { axes: constraint, orientation: 'Global' } : undefined;
    this.releaseConfirm = releaseConfirm;
    this.startCursor = [...cursor];
    this.virtualCursor = [...cursor];
    this.lastCursor = [...cursor];
    this.starts = editState.selection.flatMap((selected) => {
      const transform = worldTransformOf(selected.node);
      return transform ? [{ selected, location: toVec3(transform.GetLocation()), rotation: transform.Rotator() }] : [];
    });
    this.pivot = scale(this.starts.reduce((sum, start) => add(sum, start.location), [0, 0, 0] as Vec3), 1 / Math.max(1, this.starts.length));
    const view = viewFrameOf(controller());
    const centre = view.project(this.pivot) ?? cursor;
    this.lastAngle = screenAngle(centre, cursor);
  }

  status() {
    const what = { translate: 'Move', rotate: 'Rotate', resize: 'Scale', trackball: 'Trackball' }[this.mode];
    const along = this.constraint ? ` along ${this.constraint.axes.map((on, axis) => (on ? AXIS_NAMES[axis] : '')).join('')} (${this.constraint.orientation})` : '';
    const typed = this.numeric ? ` = ${this.numeric}${this.mode === 'translate' ? ` cm on ${AXIS_NAMES[this.numericAxis]}` : ''}` : '';
    return `${what}${along}${typed}${this.problem ? ` - ${this.problem}` : ''}`;
  }

  modal(action: string | undefined, event: InputEvent): ModalResult {
    if (event.value === 'MOVE' && event.cursor) this.moveCursor(event.cursor);
    if (this.releaseConfirm && event.type === 'LEFTMOUSE' && event.value === 'RELEASE') return this.confirm();
    if (this.typeNumber(event)) return this.update();
    switch (action) {
      case 'CONFIRM':
        return this.confirm();
      case 'CANCEL':
        revertPlan(this.plan);
        report('transform cancelled');
        return 'cancelled';
      case 'AXIS_X':
      case 'AXIS_Y':
      case 'AXIS_Z':
        this.constrain([action === 'AXIS_X', action === 'AXIS_Y', action === 'AXIS_Z']);
        break;
      case 'PLANE_X':
      case 'PLANE_Y':
      case 'PLANE_Z':
        this.constrain([action !== 'PLANE_X', action !== 'PLANE_Y', action !== 'PLANE_Z']);
        break;
      case 'CONS_OFF':
        this.constraint = undefined;
        break;
      case 'TRANSLATE':
      case 'RESIZE':
        this.switchMode(action === 'TRANSLATE' ? 'translate' : 'resize');
        break;
      case 'ROTATE':
        this.switchMode(this.mode === 'rotate' ? 'trackball' : 'rotate');
        break;
      case 'SNAP_INV_ON':
      case 'SNAP_INV_OFF':
        this.snapInvert = action === 'SNAP_INV_ON';
        break;
      case 'PRECISION':
        this.precision = event.value === 'PRESS';
        break;
    }
    return this.update();
  }

  moveCursor(cursor: Cursor) {
    const factor = this.precision ? PRECISION_FACTOR[this.mode] : 1;
    this.virtualCursor = [this.virtualCursor[0] + (cursor[0] - this.lastCursor[0]) * factor, this.virtualCursor[1] + (cursor[1] - this.lastCursor[1]) * factor];
    this.lastCursor = [...cursor];
  }

  constrain(axes: [boolean, boolean, boolean]) {
    const same = this.constraint && this.constraint.axes.every((on, axis) => on === axes[axis]);
    if (!same) this.constraint = { axes, orientation: 'Global' };
    else if (this.constraint!.orientation === 'Global') this.constraint!.orientation = 'Local';
    else this.constraint = undefined;
  }

  switchMode(mode: TransformMode) {
    resetPlan(this.plan);
    this.mode = mode;
    this.angle = 0;
  }

  typeNumber(event: InputEvent) {
    if (event.value !== 'PRESS') return false;
    const digit = digitOf(event.type);
    if (digit !== undefined) this.numeric += String(digit);
    else if (event.type === 'PERIOD' || event.type === 'NUMPAD_PERIOD') this.numeric += this.numeric.includes('.') ? '' : '.';
    else if (event.type === 'MINUS' || event.type === 'NUMPAD_MINUS') this.numeric = this.numeric.startsWith('-') ? this.numeric.slice(1) : `-${this.numeric}`;
    else if (event.type === 'BACK_SPACE' && this.numeric) this.numeric = this.numeric.slice(0, -1);
    else if (event.type === 'TAB' && this.mode === 'translate') this.numericAxis = (this.numericAxis + 1) % 3;
    else return false;
    return true;
  }

  confirm(): ModalResult {
    this.update();
    if (this.problem) {
      report(`not written: ${this.problem}`);
      return 'cancelled';
    }
    void commitPlan(this.plan);
    return 'finished';
  }

  snapping() {
    return this.snapInvert ? (this.precision ? PRECISION_INCREMENT[this.mode] : INCREMENT[this.mode]) : undefined;
  }

  update(): ModalResult {
    resetPlan(this.plan);
    const view = viewFrameOf(controller());
    const problem = this.mode === 'translate' ? this.applyTranslate(view) : this.mode === 'resize' ? this.applyResize(view) : this.applyRotation(view);
    this.problem = problem;
    if (problem) revertPlan(this.plan);
    else previewPlan(this.plan);
    return 'running';
  }

  numericValue() {
    const value = Number(this.numeric);
    return this.numeric && Number.isFinite(value) ? value : undefined;
  }

  translateDelta(view: ViewFrame): Vec3 {
    const typed = this.numericValue();
    const axes = axisVectors(this.constraint?.orientation ?? 'Global');
    if (typed !== undefined) {
      const along = this.constraint ? this.constraint.axes.findIndex(Boolean) : this.numericAxis;
      return scale(axes[Math.max(0, along)], typed);
    }
    const constrained = this.constraint?.axes.filter(Boolean).length ?? 0;
    const input = this.viewPlaneMotion(view);
    let delta: Vec3 = input;
    if (constrained === 1) delta = axisProjection(view, this.pivot, axes[this.constraint!.axes.findIndex(Boolean)], input);
    else if (constrained === 2) delta = planeProjection(view, this.pivot, axes[this.constraint!.axes.findIndex((on) => !on)], input);
    const step = this.snapping();
    if (!step) return delta;
    return axes.reduce((sum, axis) => add(sum, scale(axis, roundTo(dot(delta, axis), step))), [0, 0, 0] as Vec3);
  }

  viewPlaneMotion(view: ViewFrame): Vec3 {
    const perPixel = centimetresPerPixel(view, this.pivot);
    const [dx, dy] = [this.virtualCursor[0] - this.startCursor[0], this.virtualCursor[1] - this.startCursor[1]];
    return add(scale(view.right, dx * perPixel), scale(view.up, -dy * perPixel));
  }

  applyTranslate(view: ViewFrame) {
    const delta = this.translateDelta(view);
    for (const start of this.starts) {
      const problem = addLocationDelta(this.plan, start.selected, delta);
      if (problem) return problem;
    }
    return undefined;
  }

  applyResize(view: ViewFrame) {
    const centre = view.project(this.pivot);
    if (!centre) return undefined;
    const startDistance = Math.max(1, Math.hypot(this.startCursor[0] - centre[0], this.startCursor[1] - centre[1]));
    let ratio = Math.hypot(this.virtualCursor[0] - centre[0], this.virtualCursor[1] - centre[1]) / startDistance;
    const crossed = (this.virtualCursor[0] - centre[0]) * (this.startCursor[0] - centre[0]) + (this.virtualCursor[1] - centre[1]) * (this.startCursor[1] - centre[1]) < 0;
    if (crossed) ratio = -ratio;
    ratio = this.numericValue() ?? ratio;
    const step = this.snapping();
    if (step) ratio = roundTo(ratio, step);
    if (Math.abs(ratio) < MIN_SCALE_RATIO) return 'scale would be zero';
    const factors = (this.constraint?.axes ?? [true, true, true]).map((on) => (on ? ratio : 1)) as Vec3;
    for (const start of this.starts) {
      const problem = scaleBy(this.plan, start.selected, factors);
      if (problem) return problem;
      if (this.starts.length > 1) {
        const offset = sub(start.location, this.pivot);
        const moved = sub(offset.map((value, axis) => value * factors[axis]) as Vec3, offset);
        const locationProblem = addLocationDelta(this.plan, start.selected, moved);
        if (locationProblem) return locationProblem;
      }
    }
    return undefined;
  }

  rotationAxisAndAngle(view: ViewFrame): { axis: Vec3; degrees: number } {
    if (this.mode === 'trackball') {
      const phi: Vec2 = [(this.startCursor[1] - this.virtualCursor[1]) * TRACKBALL_RADIANS_PER_PIXEL, (this.virtualCursor[0] - this.startCursor[0]) * TRACKBALL_RADIANS_PER_PIXEL];
      const horizontal = scale(view.right, phi[0] * rotationSign(view, this.pivot, view.right));
      const vertical = scale(view.up, phi[1] * rotationSign(view, this.pivot, view.up));
      const axisVector = add(horizontal, vertical);
      return { axis: normalize(axisVector), degrees: (length(axisVector) * 180) / Math.PI };
    }
    const centre = view.project(this.pivot) ?? this.virtualCursor;
    const now = screenAngle(centre, this.virtualCursor);
    let change = now - this.lastAngle;
    if (change > Math.PI) change -= 2 * Math.PI;
    if (change < -Math.PI) change += 2 * Math.PI;
    this.angle += change;
    this.lastAngle = now;
    const constrained = this.constraint?.axes.findIndex(Boolean);
    const axis = constrained !== undefined && constrained >= 0 ? axisVectors(this.constraint!.orientation)[constrained] : scale(view.forward, -1);
    const sign = rotationSign(view, this.pivot, axis);
    return { axis, degrees: this.numericValue() ?? (this.angle * 180 * sign) / Math.PI };
  }

  applyRotation(view: ViewFrame) {
    let { axis, degrees } = this.rotationAxisAndAngle(view);
    const step = this.snapping();
    if (step) degrees = roundTo(degrees, step);
    const delta = UE.KismetMathLibrary.RotatorFromAxisAndAngle(toVector(axis), degrees);
    for (const start of this.starts) {
      const problem = setWorldRotation(this.plan, start.selected, UE.KismetMathLibrary.ComposeRotators(start.rotation, delta));
      if (problem) return problem;
      if (this.starts.length > 1) {
        const offset = sub(start.location, this.pivot);
        const turned = toVec3(UE.KismetMathLibrary.RotateAngleAxis(toVector(offset), degrees, toVector(axis)));
        const locationProblem = addLocationDelta(this.plan, start.selected, sub(turned, offset));
        if (locationProblem) return locationProblem;
      }
    }
    return undefined;
  }
}

export function startTransform(start: TransformStart): ModalOperation | 'cancelled' {
  if (!editState.selection.length) return 'cancelled';
  if (editState.selection.some((selected) => !selected.inspected)) {
    report('waiting for the selection source location');
    return 'cancelled';
  }
  return new Transform(start);
}

const any = (type: string, value: Binding['value'] = 'PRESS'): Binding => ({ type, value, any: true });

export function defineTransformModalKeymap() {
  defineModalKeymap({
    name: 'Transform Modal Map',
    actions: { CONFIRM: 'Confirm', CANCEL: 'Cancel', SNAP_INV_ON: 'Snap', PRECISION: 'Precision' },
    items: [
      { action: 'CONFIRM', binding: any('RET') },
      { action: 'CANCEL', binding: any('RIGHTMOUSE') },
      { action: 'CANCEL', binding: any('ESC') },
      { action: 'SNAP_INV_ON', binding: any('LEFT_CTRL') },
      { action: 'SNAP_INV_OFF', binding: any('LEFT_CTRL', 'RELEASE') },
      { action: 'SNAP_INV_ON', binding: any('RIGHT_CTRL') },
      { action: 'SNAP_INV_OFF', binding: any('RIGHT_CTRL', 'RELEASE') },
      { action: 'PRECISION', binding: any('LEFT_SHIFT', 'ANY') },
      { action: 'PRECISION', binding: any('RIGHT_SHIFT', 'ANY') },
    ],
  });
}

export const selectionPivot = () => {
  const points = editState.selection.map((selected) => worldLocationOf(selected.node)).filter((point): point is Vec3 => Boolean(point));
  return points.length ? scale(points.reduce(add, [0, 0, 0] as Vec3), 1 / points.length) : undefined;
};
