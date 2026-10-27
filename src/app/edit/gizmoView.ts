import * as UE from 'ue';
import { $ref, $unref } from 'puerts';
import { world } from '../../shared/engine/world';
import { add, cross, distanceToSegment, dot, normalize, scale, sub, type Vec2, type Vec3 } from './gizmoMath';
import {
  ARROW_HEAD_LENGTH,
  BOX_HALF_SIZE,
  CENTER_RADIUS,
  GIZMO_SIZE_PX,
  PLANE_HALF_DIAGONAL,
  PLANE_OFFSET,
  planeAxesOf,
  type GizmoPart,
} from './gizmoParts';

const ARROW_SELECT_THRESHOLD_PX = 5;
const RING_SAMPLES = 48;
const DIAL_CLIP_BIAS = 0.02;
export const WORLD_AXES: Vec3[] = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];

export const toVec3 = (vector: UE.Vector): Vec3 => [vector.X, vector.Y, vector.Z];
export const toVector = (vec: Vec3) => new UE.Vector(vec[0], vec[1], vec[2]);

export interface ViewFrame {
  camera: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  horizontalFovDegrees: number;
  viewportWidth: number;
  project(point: Vec3): Vec2 | undefined;
  deproject(cursor: Vec2): { origin: Vec3; direction: Vec3 } | undefined;
}

export function viewFrameOf(controller: UE.PlayerController): ViewFrame {
  const manager = controller.PlayerCameraManager;
  const rotation = manager.GetCameraRotation();
  const viewport = UE.WidgetLayoutLibrary.GetViewportSize(world);
  return {
    camera: toVec3(manager.GetCameraLocation()),
    forward: toVec3(UE.KismetMathLibrary.GetForwardVector(rotation)),
    right: toVec3(UE.KismetMathLibrary.GetRightVector(rotation)),
    up: toVec3(UE.KismetMathLibrary.GetUpVector(rotation)),
    horizontalFovDegrees: manager.GetFOVAngle(),
    viewportWidth: viewport.X,
    project(point) {
      const screen = $ref(new UE.Vector2D());
      if (!controller.ProjectWorldLocationToScreen(toVector(point), screen, false)) return undefined;
      return [$unref(screen).X, $unref(screen).Y];
    },
    deproject(cursor) {
      const origin = $ref(new UE.Vector());
      const direction = $ref(new UE.Vector());
      if (!controller.DeprojectScreenPositionToWorld(cursor[0], cursor[1], origin, direction)) return undefined;
      return { origin: toVec3($unref(origin)), direction: toVec3($unref(direction)) };
    },
  };
}

export function centimetresPerPixel(view: ViewFrame, point: Vec3) {
  const depth = Math.max(1, dot(sub(point, view.camera), view.forward));
  return (2 * depth * Math.tan((view.horizontalFovDegrees * Math.PI) / 360)) / Math.max(1, view.viewportWidth);
}

export const gizmoUnitCentimetres = (view: ViewFrame, pivot: Vec3) => GIZMO_SIZE_PX * centimetresPerPixel(view, pivot);

export const viewAxisAlignment = (view: ViewFrame) => WORLD_AXES.map((axis) => 1 - Math.abs(dot(view.forward, axis)));

export function fadeOf(part: GizmoPart, alignment: number[]) {
  if (!part.fadeRange || part.axis > 2) return 1;
  const [low, high] = part.fadeRange;
  const value = part.shape === 'plane' ? 1 - alignment[part.axis] : alignment[part.axis];
  return value > high ? 1 : value < low ? 0 : (value - low) / (high - low);
}

export function ringPoints(pivot: Vec3, normal: Vec3, radius: number) {
  const seed: Vec3 = Math.abs(normal[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = normalize(cross(normal, seed));
  const v = cross(normal, u);
  return Array.from({ length: RING_SAMPLES + 1 }, (_, index) => {
    const angle = (index / RING_SAMPLES) * Math.PI * 2;
    return add(pivot, add(scale(u, Math.cos(angle) * radius), scale(v, Math.sin(angle) * radius)));
  });
}

function polylineDistance(cursor: Vec2, points: (Vec2 | undefined)[]) {
  let best = Infinity;
  for (let index = 1; index < points.length; index++) {
    const [a, b] = [points[index - 1], points[index]];
    if (a && b) best = Math.min(best, distanceToSegment(cursor, a, b));
  }
  return best;
}

function insidePolygon(point: Vec2, polygon: Vec2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = [polygon[i], polygon[j]];
    if (a[1] > point[1] !== b[1] > point[1] && point[0] < ((b[0] - a[0]) * (point[1] - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}

export function planeCorners(pivot: Vec3, normal: number, unit: number, size = PLANE_HALF_DIAGONAL): Vec3[] {
  const [a, b] = planeAxesOf(normal).map((axis) => WORLD_AXES[axis]);
  const diagonal = normalize(add(a, b));
  const across = normalize(sub(b, a));
  const centre = add(pivot, scale(diagonal, (PLANE_OFFSET + PLANE_HALF_DIAGONAL) * unit));
  return [scale(diagonal, -size), scale(across, size), scale(diagonal, size), scale(across, -size)].map((offset) => add(centre, scale(offset, unit)));
}

interface HitContext {
  view: ViewFrame;
  pivot: Vec3;
  unit: number;
  cursor: Vec2;
}

function distanceToPart(part: GizmoPart, { view, pivot, unit, cursor }: HitContext): number {
  const centre = view.project(pivot);
  if (!centre) return Infinity;
  const pixelsPerUnit = unit / centimetresPerPixel(view, pivot);
  const threshold = ARROW_SELECT_THRESHOLD_PX + part.lineWidthPx / 2;
  if (part.shape === 'arrow' || part.shape === 'box') {
    const tip = part.end + (part.shape === 'arrow' ? ARROW_HEAD_LENGTH : 2 * BOX_HALF_SIZE);
    const axis = WORLD_AXES[part.axis];
    const [from, to] = [view.project(add(pivot, scale(axis, part.start * unit))), view.project(add(pivot, scale(axis, tip * unit)))];
    return from && to ? distanceToSegment(cursor, from, to) - threshold : Infinity;
  }
  if (part.shape === 'plane') {
    const corners = planeCorners(pivot, part.axis, unit, PLANE_HALF_DIAGONAL * 1.5).map((corner) => view.project(corner));
    return corners.every(Boolean) && insidePolygon(cursor, corners as Vec2[]) ? 0 : Infinity;
  }
  const fromCentre = Math.hypot(cursor[0] - centre[0], cursor[1] - centre[1]);
  if (part.shape === 'disc') return fromCentre <= part.radius * pixelsPerUnit ? 0 : Infinity;
  if (part.shape === 'circle') {
    const rings = part.mode === 'resize' ? [CENTER_RADIUS, part.radius] : [part.radius];
    return Math.min(...rings.map((radius) => Math.abs(fromCentre - radius * pixelsPerUnit))) - threshold;
  }
  if (part.axis > 2) return Math.abs(fromCentre - part.radius * pixelsPerUnit) - threshold;
  const toCamera = normalize(sub(view.camera, pivot));
  const points = ringPoints(pivot, WORLD_AXES[part.axis], part.radius * unit).map((point) => (dot(sub(point, pivot), toCamera) >= -DIAL_CLIP_BIAS * unit ? view.project(point) : undefined));
  return polylineDistance(cursor, points) - threshold;
}

export function partUnderCursor(parts: GizmoPart[], context: HitContext, alignment: number[]): GizmoPart | undefined {
  let best: { part: GizmoPart; distance: number } | undefined;
  for (const part of parts) {
    if (fadeOf(part, alignment) <= 0) continue;
    const distance = distanceToPart(part, context);
    if (distance > 0) continue;
    if (!best || part.priority < best.part.priority || (part.priority === best.part.priority && distance < best.distance)) best = { part, distance };
  }
  return best?.part;
}
