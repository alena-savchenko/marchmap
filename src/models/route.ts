import type { Feature, LineString } from 'geojson';

export type Coordinate = { lat: number; lon: number };
export type RoutePoint = Coordinate & { elevation: number | null; distance: number };
export type RouteSegment = { points: RoutePoint[]; line: Feature<LineString> | null };
export type Route = {
  name: string;
  points: RoutePoint[];
  segments: RouteSegment[];
  totalDistance: number;
  minElevation: number | null;
  maxElevation: number | null;
};
export type RoutePosition = RoutePoint & { remainingDistance: number; offsetMeters: number };
export type GPSPosition = Coordinate & { accuracy: number | null; timestamp: number };
