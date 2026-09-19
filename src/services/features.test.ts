import { describe, expect, it } from 'vitest';
import { parseGPX, validateGPXFile } from './gpx';
import { buildRoute, positionAtDistance, snapToRoute } from './route';
import { parseMapMode, routeRegion } from './mapPolicy';
const point = (lon: number, lat = 0, elevation: number | null = 100) => ({ lon, lat, elevation });
const wrap = (content: string) => `<gpx><trk><trkseg>${content}</trkseg></trk></gpx>`;
const valid = '<trkpt lat="0" lon="0"/><trkpt lat="0" lon="0.1"/>';
describe('file validation', () => {
  it.each(['photo.jpg', 'route.xml', 'route.gpx.zip', 'route', 'route.gpx.exe'])('rejects wrong extension %s', (name) => expect(() => validateGPXFile(name, 100)).toThrow());
  it.each([0, -1, NaN, 26 * 1024 * 1024])('rejects invalid size %s', (size) => expect(() => validateGPXFile('track.gpx', size)).toThrow());
  it('accepts uppercase extension', () => expect(() => validateGPXFile('TRACK.GPX', 100)).not.toThrow());
  it.each(['{}', 'not xml', '<html><body>test</body></html>', '<gpx><wpt lat="0" lon="0"/></gpx>', '<gpx><trk>wrong</trk></gpx>', wrap(`${valid}<trkpt>invalid</trkpt>`), wrap(`${valid}<trkpt/>`), wrap('<trkpt lat="0x12" lon="0"/>' + valid), wrap('<trkpt lat="NaN" lon="0"/>' + valid), wrap('<trkpt lat="0" lon="181"/>' + valid), wrap('<trkpt lat="0" lon="0"><ele>bad</ele></trkpt>' + valid), wrap('<trkpt lat="0" lon="0"><ele>1</ele><ele>2</ele></trkpt>' + valid), '<gpx/><gpx/>'])('rejects mismatched GPX contents %s', (xml) => expect(() => parseGPX(xml)).toThrow());
});
describe('profile selection', () => {
  const route = buildRoute([[point(0, 50, 100), point(1, 51, 300)], [point(10, 52, null), point(11, 52, 400)]]);
  it('round trips through map snapping on a great-circle edge', () => {
    const selected = positionAtDistance(route, route.points[1].distance * 0.35);
    const snapped = snapToRoute(route, selected);
    expect(snapped.offsetMeters).toBeLessThan(0.001);
    expect(snapped.distance).toBeCloseTo(selected.distance, 5);
    expect(selected.elevation).toBeCloseTo(170, 5);
  });
  it('does not bridge segment gaps or missing elevations', () => {
    const boundary = route.points[1].distance;
    expect(positionAtDistance(route, boundary).lon).toBe(1);
    expect(positionAtDistance(route, boundary + 0.1).lon).toBeGreaterThan(10);
    expect(positionAtDistance(route, boundary + 0.1).elevation).toBeNull();
  });
  it('clamps endpoints and nonfinite inputs', () => {
    expect(positionAtDistance(route, -10).lon).toBe(0);
    expect(positionAtDistance(route, NaN).distance).toBe(0);
    expect(positionAtDistance(route, 10000).remainingDistance).toBe(0);
    expect(positionAtDistance(route, 10000).lon).toBe(11);
  });
  it('handles duplicate and zero-distance points', () => expect(positionAtDistance(buildRoute([[point(0), point(0)]]), 0).distance).toBe(0));
});
describe('map policy', () => {
  it('defaults to hybrid and restores all valid modes', () => {
    expect(parseMapMode(null)).toBe('hybrid'); expect(parseMapMode('broken')).toBe('hybrid');
    for (const mode of ['online', 'offline', 'hybrid']) expect(parseMapMode(mode)).toBe(mode);
  });
  it('buffers every segment, bounds the supported projection', () => {
    expect(routeRegion(buildRoute([[point(1, 50), point(2, 51)]]))).toEqual([0.99, 49.99, 2.01, 51.01]);
    expect(() => routeRegion(buildRoute([[point(0, 89), point(1, 89)]]))).toThrow();
  });
});
