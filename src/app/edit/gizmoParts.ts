import type { Vec3 } from './gizmoMath';

export type TransformMode = 'translate' | 'rotate' | 'resize' | 'trackball';
export type GizmoTool = 'select' | 'move' | 'rotate' | 'scale' | 'transform';
export type PartShape = 'arrow' | 'box' | 'plane' | 'circle' | 'ring' | 'disc';

export interface GizmoPart {
  id: string;
  label: string;
  shape: PartShape;
  axis: number;
  start: number;
  end: number;
  radius: number;
  stem: boolean;
  lineWidthPx: number;
  color: Vec3;
  mode: TransformMode;
  constraint: [boolean, boolean, boolean];
  priority: number;
  fadeRange?: [number, number];
}

export const GIZMO_SIZE_PX = 75;
export const GIZMO_AXIS_LINE_WIDTH_PX = 2;
export const ALPHA = 0.6;
export const ALPHA_HIGHLIGHT = 1;
export const TRACKBALL_ALPHA_FACTOR = 0.05;
export const PLANE_OFFSET = 0.7;
export const PLANE_HALF_DIAGONAL = 0.1;
export const ARROW_HEAD_LENGTH = 0.25;
export const ARROW_HEAD_RADIUS = 0.06;
export const BOX_HALF_SIZE = 0.05;
export const CENTER_RADIUS = 0.2;
export const VIEW_RING_RADIUS = 1.2;
export const SCALE_OUTER_RADIUS = 1.2;

const AXIS_FADE: [number, number] = [0.02, 0.1];
const PLANE_FADE: [number, number] = [0.175, 0.25];
const AXIS_NAMES = ['X', 'Y', 'Z'];
const PLANE_AXES: [number, number][] = [
  [1, 2],
  [2, 0],
  [0, 1],
];

const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const themeColor = (hex: number): Vec3 => [linear(((hex >> 16) & 255) / 255), linear(((hex >> 8) & 255) / 255), linear((hex & 255) / 255)];

export const AXIS_COLORS: Vec3[] = [themeColor(0xff3352), themeColor(0x8bdc00), themeColor(0x2890ff)];
export const VIEW_ALIGN_COLOR: Vec3 = themeColor(0xffffff);

const only = (axis: number): [boolean, boolean, boolean] => [axis === 0, axis === 1, axis === 2];
const planeOf = (normal: number): [boolean, boolean, boolean] => [normal !== 0, normal !== 1, normal !== 2];

interface ToolSet {
  translate: boolean;
  rotate: boolean;
  scale: boolean;
}

const TOOL_SETS: Record<GizmoTool, ToolSet> = {
  select: { translate: false, rotate: false, scale: false },
  move: { translate: true, rotate: false, scale: false },
  rotate: { translate: false, rotate: true, scale: false },
  scale: { translate: false, rotate: false, scale: true },
  transform: { translate: true, rotate: true, scale: true },
};

function lineRange(set: ToolSet, mode: 'translate' | 'resize'): [number, number] {
  let start = 0.2;
  let end = 1;
  if (mode === 'translate') {
    if (set.scale) start = end - 0.125;
    if (set.rotate) {
      start += 0.215;
      end += 0.215 + 0.2;
    }
  } else if (set.translate || set.rotate) {
    end -= 0.225;
  }
  return [start, end];
}

const part = (fields: Partial<GizmoPart> & Pick<GizmoPart, 'id' | 'label' | 'shape' | 'mode' | 'priority'>): GizmoPart => ({
  axis: 3,
  start: 0,
  end: 0,
  radius: 0,
  stem: true,
  lineWidthPx: GIZMO_AXIS_LINE_WIDTH_PX,
  color: VIEW_ALIGN_COLOR,
  constraint: [false, false, false],
  ...fields,
});

function translateParts(set: ToolSet): GizmoPart[] {
  const [start, end] = lineRange(set, 'translate');
  const parts = [0, 1, 2].map((axis) =>
    part({ id: `translate-${axis}`, label: `Move along ${AXIS_NAMES[axis]}`, shape: 'arrow', mode: 'translate', axis, start, end, stem: !set.rotate && !set.scale, color: AXIS_COLORS[axis], constraint: only(axis), priority: 1, fadeRange: AXIS_FADE }),
  );
  if (!set.rotate) {
    parts.push(
      ...[0, 1, 2].map((normal) =>
        part({ id: `translate-plane-${normal}`, label: `Move in the ${PLANE_AXES[normal].map((axis) => AXIS_NAMES[axis]).join('')} plane`, shape: 'plane', mode: 'translate', axis: normal, lineWidthPx: 1, color: AXIS_COLORS[normal], constraint: planeOf(normal), priority: 1, fadeRange: PLANE_FADE }),
      ),
    );
  }
  parts.push(part({ id: 'translate-view', label: 'Move in the view plane', shape: 'circle', mode: 'translate', radius: CENTER_RADIUS, priority: 0 }));
  return parts;
}

function rotateParts(): GizmoPart[] {
  return [
    ...[0, 1, 2].map((axis) =>
      part({ id: `rotate-${axis}`, label: `Rotate around ${AXIS_NAMES[axis]}`, shape: 'ring', mode: 'rotate', axis, radius: 1, lineWidthPx: GIZMO_AXIS_LINE_WIDTH_PX + 1, color: AXIS_COLORS[axis], constraint: only(axis), priority: 2 }),
    ),
    part({ id: 'rotate-view', label: 'Rotate around the view axis', shape: 'ring', mode: 'rotate', radius: VIEW_RING_RADIUS, priority: 3 }),
    part({ id: 'trackball', label: 'Trackball rotate', shape: 'disc', mode: 'trackball', radius: 1, priority: 4 }),
  ];
}

function scaleParts(set: ToolSet): GizmoPart[] {
  const [start, end] = lineRange(set, 'resize');
  const parts = [0, 1, 2].map((axis) =>
    part({ id: `scale-${axis}`, label: `Scale along ${AXIS_NAMES[axis]}`, shape: 'box', mode: 'resize', axis, start, end, color: AXIS_COLORS[axis], constraint: only(axis), priority: 1, fadeRange: AXIS_FADE }),
  );
  if (!set.translate && !set.rotate) {
    parts.push(
      ...[0, 1, 2].map((normal) =>
        part({ id: `scale-plane-${normal}`, label: `Scale in the ${PLANE_AXES[normal].map((axis) => AXIS_NAMES[axis]).join('')} plane`, shape: 'plane', mode: 'resize', axis: normal, lineWidthPx: 1, color: AXIS_COLORS[normal], constraint: planeOf(normal), priority: 1, fadeRange: PLANE_FADE }),
      ),
    );
  }
  if (!set.translate) parts.push(part({ id: 'scale-uniform', label: 'Scale uniformly', shape: 'circle', mode: 'resize', radius: SCALE_OUTER_RADIUS, priority: 0 }));
  return parts;
}

export function gizmoPartsOf(tool: GizmoTool): GizmoPart[] {
  const set = TOOL_SETS[tool];
  return [...(set.translate ? translateParts(set) : []), ...(set.rotate ? rotateParts() : []), ...(set.scale ? scaleParts(set) : [])];
}

export const planeAxesOf = (normal: number) => PLANE_AXES[normal];
