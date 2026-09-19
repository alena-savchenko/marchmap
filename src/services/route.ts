import { distance } from '@turf/distance';
import { lineString, point } from '@turf/helpers';
import { nearestPointOnLine } from '@turf/nearest-point-on-line';
import type { Coordinate, Route, RoutePoint, RoutePosition } from '../models/route';

export const ROUTE_THRESHOLD_METERS = 30;
export type InputPoint = Coordinate & { elevation: number | null };
const xy = (p: Coordinate): [number, number] => [p.lon, p.lat];
export const geodesicDistance = (a: Coordinate, b: Coordinate) => distance(xy(a), xy(b));

export function buildRoute(input: InputPoint[][], name = 'Маршрут'): Route {
  let cumulative = 0;
  const points: RoutePoint[] = [];
  const segments = input.filter((segment) => segment.length).map((segment) => {
    const segmentPoints = segment.map((p, index) => {
      if (index) cumulative += geodesicDistance(segment[index - 1], p);
      const routePoint = { ...p, distance: cumulative };
      points.push(routePoint);
      return routePoint;
    });
    return { points: segmentPoints, line: segmentPoints.length > 1 ? lineString(segmentPoints.map(xy)) : null };
  });
  if (points.length < 2) throw new Error('В GPX должно быть хотя бы две точки трека.');
  let minElevation: number | null = null;
  let maxElevation: number | null = null;
  for (const p of points) {
    if (p.elevation !== null) {
      minElevation = minElevation === null ? p.elevation : Math.min(minElevation, p.elevation);
      maxElevation = maxElevation === null ? p.elevation : Math.max(maxElevation, p.elevation);
    }
  }
  return { name, points, segments, totalDistance: cumulative, minElevation, maxElevation };
}

export function snapToRoute(route: Route, coordinate: Coordinate): RoutePosition {
  let best: RoutePosition | null = null;
  for (const segment of route.segments) {
    const first = segment.points[0];
    let candidate: RoutePosition;
    if (!segment.line) {
      candidate = { ...first, remainingDistance: route.totalDistance - first.distance, offsetMeters: geodesicDistance(first, coordinate) * 1000 };
    } else {
      const snapped = nearestPointOnLine(segment.line, point(xy(coordinate)), { units: 'kilometers' });
      const index = Math.min(snapped.properties.index, segment.points.length - 1);
      const a = segment.points[index];
      const b = segment.points[Math.min(index + 1, segment.points.length - 1)];
      const along = Math.max(first.distance, Math.min(segment.points[segment.points.length - 1].distance, first.distance + snapped.properties.location));
      const fraction = b.distance > a.distance ? Math.max(0, Math.min(1, (along - a.distance) / (b.distance - a.distance))) : 0;
      const elevation = fraction <= 1e-9 ? a.elevation : fraction >= 1 - 1e-9 ? b.elevation : a.elevation !== null && b.elevation !== null ? a.elevation + (b.elevation - a.elevation) * fraction : null;
      candidate = { lon: snapped.geometry.coordinates[0], lat: snapped.geometry.coordinates[1], elevation, distance: along, remainingDistance: Math.max(0, route.totalDistance - along), offsetMeters: snapped.properties.dist * 1000 };
    }
    if (!best || candidate.offsetMeters < best.offsetMeters) best = candidate;
  }
  return best!;
}

export function currentRoutePosition(route: Route, coordinate: Coordinate, threshold = ROUTE_THRESHOLD_METERS): RoutePosition | null {
  const snapped = snapToRoute(route, coordinate);
  return snapped.offsetMeters <= threshold ? snapped : null;
}
