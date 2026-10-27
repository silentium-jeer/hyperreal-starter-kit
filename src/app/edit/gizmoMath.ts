export type Vec3 = [number, number, number];
export type Vec2 = [number, number];

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, s: number): Vec3 => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const length = (a: Vec3) => Math.sqrt(dot(a, a));
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const normalize = (a: Vec3): Vec3 => {
  const size = length(a);
  return size > 1e-9 ? scale(a, 1 / size) : [0, 0, 0];
};

export function intersectPlane(rayOrigin: Vec3, rayDirection: Vec3, planePoint: Vec3, planeNormal: Vec3): Vec3 | undefined {
  const facing = dot(rayDirection, planeNormal);
  if (Math.abs(facing) < 1e-9) return undefined;
  const distance = dot(sub(planePoint, rayOrigin), planeNormal) / facing;
  return add(rayOrigin, scale(rayDirection, distance));
}

export function closestParameterOnAxis(origin: Vec3, axis: Vec3, rayOrigin: Vec3, rayDirection: Vec3): number | undefined {
  const axisAxis = dot(axis, axis);
  const axisRay = dot(axis, rayDirection);
  const rayRay = dot(rayDirection, rayDirection);
  const denominator = axisAxis * rayRay - axisRay * axisRay;
  if (Math.abs(denominator) < 1e-9) return undefined;
  const toOrigin = sub(origin, rayOrigin);
  return (axisRay * dot(rayDirection, toOrigin) - rayRay * dot(axis, toOrigin)) / denominator;
}

export function distanceToSegment(point: Vec2, start: Vec2, end: Vec2) {
  const segment: Vec2 = [end[0] - start[0], end[1] - start[1]];
  const lengthSquared = segment[0] * segment[0] + segment[1] * segment[1];
  const along = lengthSquared ? Math.max(0, Math.min(1, ((point[0] - start[0]) * segment[0] + (point[1] - start[1]) * segment[1]) / lengthSquared)) : 0;
  return Math.hypot(point[0] - (start[0] + segment[0] * along), point[1] - (start[1] + segment[1] * along));
}
