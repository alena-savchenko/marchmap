import { describe, expect, it } from 'vitest';
import { buildRoute, currentRoutePosition, snapToRoute } from './route';
import { parseGPX } from './gpx';
const p = (lon: number, lat = 0, elevation: number | null = 100) => ({ lon, lat, elevation });
const route = buildRoute([[p(0), p(0.01, 0, 200), p(0.02, 0, 300)]]);
describe('route engine', () => {
  it('computes geodesic cumulative distance in km', () => {
    expect(route.points[0].distance).toBe(0);
    expect(route.points[1].distance).toBeCloseTo(1.1119508, 6);
    expect(route.points[2].distance).toBeCloseTo(2.2239016, 6);
  });
  it('computes total distance', () => expect(route.totalDistance).toBe(route.points[2].distance));
  it('does not bridge track segments in distance or geometry', () => {
    const split = buildRoute([[p(0), p(0.01)], [p(1), p(1.01)]]);
    expect(split.totalDistance).toBeCloseTo(2.2239016, 6);
    expect(split.points[2].distance).toBe(split.points[1].distance);
    expect(split.segments).toHaveLength(2);
    expect(currentRoutePosition(split, p(0.5))).toBeNull();
    expect(snapToRoute(split, p(1.005)).distance).toBeCloseTo(1.6679262, 5);
  });
  it('snaps onto an edge and interpolates elevation', () => {
    const result = snapToRoute(route, p(0.005, 0.0001));
    expect(result.lon).toBeCloseTo(0.005, 7);
    expect(result.lat).toBeCloseTo(0, 7);
    expect(result.elevation).toBeCloseTo(150, 5);
    expect(result.offsetMeters).toBeCloseTo(11.1195, 3);
  });
  it('accepts current position inside threshold', () => expect(currentRoutePosition(route, p(0.005, 0.0002))).not.toBeNull());
  it('rejects current position outside threshold', () => expect(currentRoutePosition(route, p(0.005, 0.001))).toBeNull());
  it('uses an inclusive configurable threshold', () => {
    const location = p(0.005, 0.001);
    const offset = snapToRoute(route, location).offsetMeters;
    expect(currentRoutePosition(route, location, offset)).not.toBeNull();
    expect(currentRoutePosition(route, location, offset - 0.001)).toBeNull();
  });
  it('computes remaining distance including endpoints', () => {
    expect(snapToRoute(route, p(0.005)).remainingDistance).toBeCloseTo(route.totalDistance * 0.75, 7);
    expect(snapToRoute(route, p(0.02)).remainingDistance).toBe(0);
    expect(snapToRoute(route, p(-1)).distance).toBe(0);
  });
  it('handles missing elevations, duplicate coordinates and singleton segments', () => {
    const mixed = buildRoute([[p(0, 0, null), p(0), p(0.01, 0, null)], [p(1)]]);
    expect(snapToRoute(mixed, p(0.005)).elevation).toBeNull();
    expect(snapToRoute(mixed, p(1)).remainingDistance).toBe(0);
    expect(Number.isFinite(snapToRoute(mixed, p(0)).distance)).toBe(true);
  });
  it('handles thousands of samples over 100 km', () => {
    const large = buildRoute([Array.from({ length: 6000 }, (_, i) => p(i / 6000, 0, i % 300))]);
    expect(large.totalDistance).toBeGreaterThan(100);
    expect(snapToRoute(large, p(0.5)).distance).toBeCloseTo(55.59754, 4);
  });
  it('handles a zero-length route without NaN', () => {
    const zero = buildRoute([[p(0), p(0)]]);
    const snapped = snapToRoute(zero, p(0.001));
    expect(snapped.distance).toBe(0);
    expect(snapped.remainingDistance).toBe(0);
    expect(snapped.offsetMeters).toBeCloseTo(111.195, 3);
  });
});
describe('GPX import', () => {
  it('reads tracks, segments, namespaces, name and missing elevation', () => {
    const result = parseGPX('<g:gpx xmlns:g="urn:gpx"><g:trk><g:name>A &amp; B</g:name><g:trkseg><g:trkpt lat="0" lon="0"><g:ele>0</g:ele></g:trkpt><g:trkpt lat="0" lon="0.01"/></g:trkseg></g:trk><g:trk><g:trkseg><g:trkpt lat="1" lon="1"><g:ele>-12</g:ele></g:trkpt><g:trkpt lat="1" lon="1.01"><g:ele>200</g:ele></g:trkpt></g:trkseg></g:trk></g:gpx>');
    expect(result.name).toBe('A & B'); expect(result.segments).toHaveLength(2);
    expect(result.points[1].elevation).toBeNull();
    expect(result.points[2].distance).toBe(result.points[1].distance);
    expect(result.minElevation).toBe(-12); expect(result.maxElevation).toBe(200);
  });
  it.each(['<gpx>', '<html/>', '<gpx/>', '<gpx><trk><trkseg><trkpt lat="91" lon="0"/><trkpt lat="0" lon="0"/></trkseg></trk></gpx>', '<!DOCTYPE gpx><gpx/>'])('rejects invalid input %s', (xml) => expect(() => parseGPX(xml)).toThrow());
  it('preserves null bounds when no elevations exist', () => {
    const result = parseGPX('<gpx><trk><trkseg><trkpt lat="0" lon="0"/><trkpt lat="0" lon="1"/></trkseg></trk></gpx>', 'sample');
    expect(result.minElevation).toBeNull(); expect(result.maxElevation).toBeNull(); expect(result.name).toBe('sample');
  });
});
