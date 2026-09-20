import { describe, expect, it } from 'vitest';
import type { Route } from '../models/route';
import { DEFAULT_CLIMB_SETTINGS, type ClimbSettings } from '../config/climbs';
import { applyClimbSettings, calculateClimbScore, detectClimbs, getClimbPreview, getClimbThresholdForSettings, getCurrentClimbStatus, preprocessElevationProfile } from './climbs';
import { parseGPX } from './gpx';
const settings = (preset: ClimbSettings['preset']): ClimbSettings => ({ ...DEFAULT_CLIMB_SETTINGS, preset });
function rawRoute(runs: [number, number | null][][]): Route {
  const segments = runs.map(run => ({ line: null, points: run.map(([distance, elevation]) => ({ distance, elevation, lat: 0, lon: distance / 111 })) }));
  const points = segments.flatMap(s => s.points);
  return { name: 'test', segments, points, totalDistance: points.at(-1)!.distance, minElevation: null, maxElevation: null, climbs: [], climbCandidates: [] };
}
function ramp(anchors: [number, number][], step = .025): [number, number][] {
  const points: [number, number][] = [anchors[0]];
  for (let i = 1; i < anchors.length; i++) {
    const [x, y] = anchors[i - 1], [end, top] = anchors[i];
    const count = Math.ceil((end - x) / step);
    for (let j = 1; j <= count; j++) points.push([x + (end - x) * j / count, y + (top - y) * j / count]);
  }
  return points;
}
function analyze(points: [number, number | null][], preset: ClimbSettings['preset'] = 'medium'): Route {
  const route = rawRoute([points]);
  route.climbCandidates = detectClimbs(preprocessElevationProfile(route));
  return applyClimbSettings(route, settings(preset));
}
const climbs = (anchors: [number, number][], preset: ClimbSettings['preset'] = 'medium') => analyze(ramp(anchors), preset).climbs;
describe('trend detection and summit confirmation', () => {
  it('finds a long moderate climb', () => expect(climbs([[0,0],[2,100]])).toHaveLength(1));
  it('finds a short steep climb', () => expect(climbs([[0,0],[.5,60]])).toHaveLength(1));
  it('allows a 300m steep climb without hardcoded distance/grade pairs', () => expect(climbs([[0,0],[.3,45]])).toHaveLength(1));
  it('rejects a long gentle slope below the score threshold', () => expect(climbs([[0,0],[2,60]])).toHaveLength(0));
  it('rejects a small noisy hill even in high sensitivity', () => expect(climbs([[0,0],[.1,10],[.2,0]], 'high')).toHaveLength(0));
  it('merges a short shelf within a large climb', () => {
    const result = climbs([[0,0],[1,80],[1.15,80],[2.15,190]]);
    expect(result).toHaveLength(1); expect(result[0].endDistance).toBeCloseTo(2.15);
  });
  it('merges +80 -8 +110 into one climb', () => {
    const result = climbs([[0,0],[1,80],[1.1,72],[2.1,182]]);
    expect(result).toHaveLength(1); expect(result[0].elevationGain).toBeCloseTo(182);
  });
  it('splits climbs after a substantial descent', () => expect(climbs([[0,0],[1,100],[1.4,40],[2.4,140]])).toHaveLength(2));
  it('does not merge a shallow but overlong dip', () => expect(climbs([[0,0],[1,100],[1.35,92],[2.35,192]])).toHaveLength(2));
  it('confirms the earlier summit after a long plateau', () => {
    const result = climbs([[0,0],[1,100],[1.5,100],[2.5,200]]);
    expect(result).toHaveLength(2); expect(result[0].endDistance).toBeLessThanOrEqual(1.025);
  });
  it('splits at missing elevations', () => {
    const points: [number, number | null][] = [...ramp([[0,0],[1,100]]), [1.1,null], ...ramp([[1.2,0],[2.2,100]])];
    const result = analyze(points).climbs;
    expect(result).toHaveLength(2); expect(result[0].endDistance).toBe(1); expect(result[1].startDistance).toBe(1.2);
  });
  it('splits at GPX track boundaries and ignores unknown profiles', () => {
    const route = rawRoute([ramp([[0,0],[1,100]]), ramp([[1,500],[2,600]])]);
    expect(detectClimbs(preprocessElevationProfile(route), 40)).toHaveLength(2);
    expect(preprocessElevationProfile(rawRoute([[[0,null],[1,null]]]))).toEqual([]);
  });
  it('does not turn duplicate-distance elevation jumps into a vertical climb', () => {
    expect(analyze([[0,0],[0,400],[.2,410]], 'high').climbs).toHaveLength(0);
  });
  it('smooths isolated spikes without inventing multiple climbs', () => {
    const points = ramp([[0,0],[3,180]]).map(([d,h],i): [number,number] => [d, h + (i % 7 === 0 ? 3 : i % 5 === 0 ? -3 : 0)]);
    expect(analyze(points).climbs).toHaveLength(1);
    const flat = ramp([[0,100],[10,100]]).map(([d,h],i): [number,number] => [d, h + (i % 11 === 0 ? 25 : i % 2 ? 3 : -3)]);
    expect(analyze(flat, 'high').climbs).toHaveLength(0);
  });
  it('never changes original distances or elevations', () => {
    const route = rawRoute([ramp([[0,0],[2,100]])]); const before = JSON.stringify(route);
    for (const point of route.points) Object.freeze(point);
    preprocessElevationProfile(route); expect(JSON.stringify(route)).toBe(before);
  });
});
describe('sensitivity and custom difficulty curve', () => {
  const points = ramp([[0,0],[.8,48],[1.2,0],[2.2,80],[2.6,0],[4.6,160]]);
  it('high finds more climbs', () => expect(analyze(points,'high').climbs).toHaveLength(3));
  it('medium selects noticeable climbs', () => expect(analyze(points,'medium').climbs).toHaveLength(2));
  it('low keeps only the hardest climbs', () => expect(analyze(points,'low').climbs).toHaveLength(1));
  it('calculates the custom threshold from a reference pair', () => expect(getClimbThresholdForSettings(settings('custom'))).toBeCloseTo(28.8));
  it('isolates the replaceable score formula', () => { expect(calculateClimbScore(.8,6)).toBeCloseTo(28.8); expect(calculateClimbScore(.5,12)).toBe(72); expect(calculateClimbScore(0,10)).toBe(0); expect(calculateClimbScore(1,NaN)).toBe(0); });
  it('custom allows both shorter steeper and longer gentler climbs', () => {
    expect(analyze(ramp([[0,0],[.5,50]]), 'custom').climbs).toHaveLength(1);
    expect(analyze(ramp([[0,0],[2,80]]), 'custom').climbs).toHaveLength(1);
  });
  it('computes realistic minimum distances including technical cutoffs', () => {
    expect(getClimbPreview(settings('custom')).map(p => [p.grade,p.distanceM])).toEqual([[4,1800],[6,800],[8,450],[10,300],[12,250]]);
    expect(getClimbPreview({...settings('custom'),customGrade:1,customDistanceM:250}).every(p => p.distanceM >= 250 && p.grade * p.distanceM / 100 >= 30)).toBe(true);
  });
  it('refilters candidates without reading or analyzing the profile', () => {
    const route = analyze(points); const changed = applyClimbSettings(route, settings('high'));
    expect(changed.climbCandidates).toBe(route.climbCandidates); expect(changed.points).toBe(route.points); expect(changed.segments).toBe(route.segments);
    expect(changed.climbs).toHaveLength(3); expect(route.climbs).toHaveLength(2);
  });
});
describe('current route position only', () => {
  const route = analyze(ramp([[0,0],[2,100]]));
  it('shows a card at the climb start', () => expect(getCurrentClimbStatus(route,0)?.remainingGain).toBeCloseTo(100));
  it('shows a card in the middle', () => expect(getCurrentClimbStatus(route,1)).not.toBeNull());
  it('hides after the summit including its exact endpoint', () => { expect(getCurrentClimbStatus(route,2)).toBeNull(); expect(getCurrentClimbStatus(route,2.1)).toBeNull(); });
  it('computes remaining distance along the route', () => expect(getCurrentClimbStatus(route,.75)?.remainingDistance).toBeCloseTo(1.25));
  it('interpolates remaining gain from original GPX heights', () => expect(getCurrentClimbStatus(route,.713)?.remainingGain).toBeCloseTo(64.35));
  it('hides for off-route, unknown elevation, and near the summit', () => {
    expect(getCurrentClimbStatus(route,null)).toBeNull(); expect(getCurrentClimbStatus(route,NaN)).toBeNull(); expect(getCurrentClimbStatus(route,-.1)).toBeNull(); expect(getCurrentClimbStatus(route,1.9)).toBeNull();
    expect(getCurrentClimbStatus({...route,points: route.points.map(p=>({...p,elevation:null}))},1)).toBeNull();
  });
  it('honours a stricter threshold even if passed an older model', () => expect(getCurrentClimbStatus(route,1,settings('low'))).toBeNull());
  it('uses logarithmic elevation lookup on GPS updates', () => {
    const points = Array.from({length:10001}, (_,i) => ({distance:i/5000,elevation:i/100,lat:0,lon:0}));
    let reads=0;
    const tracked = new Proxy(points, {get(target,key,receiver) { if(typeof key==='string' && /^\d+$/.test(key)) reads++; return Reflect.get(target,key,receiver); }});
    expect(getCurrentClimbStatus({...route,points:tracked},1)?.remainingGain).toBeCloseTo(50);
    expect(reads).toBeLessThan(40);
  });});
it('GPX import stores candidates and significant climbs in RouteModel', () => {
  const route = parseGPX('<gpx><trk><trkseg><trkpt lat="0" lon="0"><ele>0</ele></trkpt><trkpt lat="0" lon="0.018"><ele>100</ele></trkpt></trkseg></trk></gpx>');
  expect(route.climbs).toHaveLength(1); expect(route.climbCandidates).toHaveLength(1);
});
it('processes 10k points over 100km promptly', () => {
  const points: [number,number][] = Array.from({length:10001},(_,i)=>[i/100,500+200*Math.sin(i/150)+(i%3-1)*2]);
  const start = performance.now(); const route = analyze(points); const elapsed = performance.now()-start;
  expect(route.climbs.length).toBeGreaterThan(0); expect(elapsed).toBeLessThan(1000);
  console.info(`Climb analysis 10,001 points / 100 km: ${elapsed.toFixed(2)} ms`);
});

it('hides at exact remaining thresholds despite floating point rounding', () => {
  const route = analyze(ramp([[0,0],[2.1,420]]));
  expect(getCurrentClimbStatus(route,2)).toBeNull();
  const moderate = analyze(ramp([[0,0],[2,100]]));
  expect(getCurrentClimbStatus(moderate,1.8)).toBeNull();
});
it('preset changes do not move any candidate boundary', () => {
  const route = analyze(ramp([[0,0],[.8,48],[1.2,0],[2.2,80],[2.6,0],[4.6,160]]));
  const high=applyClimbSettings(route,settings('high')), low=applyClimbSettings(route,settings('low'));
  expect(low.climbs.every(climb=>high.climbs.includes(climb))).toBe(true);
});
