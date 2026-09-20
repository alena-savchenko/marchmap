import type { ClimbSegment, Route, RoutePoint } from '../models/route';
import * as C from '../config/climbs';
export type ElevationSample = { distanceKm: number; elevationM: number };
export type ClimbStatus = { climb: ClimbSegment; remainingDistance: number; remainingGain: number };

/** Distance resampling followed by a centred rolling median. Never alters GPX points.
 * Each GPX segment and each missing/invalid height splits analysis into independent runs.
 * The median window has a fixed small size, so total work is O(points + samples).
 */
export function preprocessElevationProfile(route: Pick<Route, 'segments'>): ElevationSample[][] {
  const result: ElevationSample[][] = [];
  const step = C.CLIMB_RESAMPLE_DISTANCE_M / 1000;
  const radius = Math.floor(C.CLIMB_SMOOTHING_WINDOW_M / C.CLIMB_RESAMPLE_DISTANCE_M / 2);
  function flush(points: RoutePoint[]) {
    if (points.length < 2) return;
    const samples: ElevationSample[] = [];
    let edge = 1;
    const first = points[0], last = points[points.length - 1];
    for (let index = 0; ; index++) {
      const distanceKm = Math.min(last.distance, first.distance + index * step);
      while (edge < points.length - 1 && points[edge].distance < distanceKm) edge++;
      const a = points[edge - 1], b = points[edge];
      const fraction = (distanceKm - a.distance) / (b.distance - a.distance);
      samples.push({ distanceKm, elevationM: a.elevation! + fraction * (b.elevation! - a.elevation!) });
      if (distanceKm >= last.distance) break;
    }
    result.push(samples.map((sample, i) => {
      // Shrink symmetrically at boundaries: linear ramps retain their start and summit heights.
      const r = Math.min(radius, i, samples.length - 1 - i);
      const window = samples.slice(i - r, i + r + 1).map(p => p.elevationM).sort((a, b) => a - b);
      return { ...sample, elevationM: window[r] };
    }));
  }
  for (const segment of route.segments) {
    let run: RoutePoint[] = [];
    for (const point of segment.points) {
      if (point.elevation === null || !Number.isFinite(point.elevation) || !Number.isFinite(point.distance)) { flush(run); run = []; continue; }
      if (run.length && point.distance <= run[run.length - 1].distance) { flush(run); run = []; }
      run.push(point);
    }
    flush(run);
  }
  return result;
}

export function calculateClimbScore(distanceKm: number, averageGradePercent: number): number {
  return Number.isFinite(distanceKm) && Number.isFinite(averageGradePercent) && distanceKm > 0 && averageGradePercent > 0 ? distanceKm * averageGradePercent ** 2 : 0;
}
export function getClimbThresholdForSettings(settings: C.ClimbSettings): number {
  return settings.preset === 'custom' ? calculateClimbScore(settings.customDistanceM / 1000, settings.customGrade)
    : C.CLIMB_PRESETS.find(p => p.id === settings.preset)!.thresholdScore;
}
export function getClimbPreview(settings: C.ClimbSettings) {
  const threshold = getClimbThresholdForSettings(settings);
  return C.CLIMB_PREVIEW_GRADES.map(grade => ({ grade, distanceM: Math.ceil(Math.max(
    threshold / grade ** 2 * 1000, C.ABSOLUTE_MIN_CLIMB_DISTANCE_M, C.ABSOLUTE_MIN_CLIMB_GAIN_M * 100 / grade,
  ) / C.CLIMB_PREVIEW_ROUNDING_M) * C.CLIMB_PREVIEW_ROUNDING_M }));
}

/** Tracks a rising trend, merging short flat/dip fragments before significance filtering.
 * A pause is held pending: only a long plateau, an excessive dip, or the end of a
 * valid run confirms the last peak as summit. No rescan or lookahead of the profile.
 */
export function detectClimbs(profile: ElevationSample[][], thresholdScore = 0): ClimbSegment[] {
  const climbs: ClimbSegment[] = [];
  for (const run of profile) {
    if (run.length < 2) continue;
    let valley = 0, peak = 0, trough = 0, pause: number | null = null, active = false;
    const emit = () => {
      const start = run[valley], summit = run[peak];
      const distanceKm = summit.distanceKm - start.distanceKm;
      const elevationGain = summit.elevationM - start.elevationM;
      const averageGradePercent = elevationGain / (distanceKm * 10);
      const difficultyScore = calculateClimbScore(distanceKm, averageGradePercent);
      if (distanceKm * 1000 + 1e-7 < C.ABSOLUTE_MIN_CLIMB_DISTANCE_M || elevationGain + 1e-7 < C.ABSOLUTE_MIN_CLIMB_GAIN_M || averageGradePercent + 1e-7 < C.ABSOLUTE_MIN_AVG_GRADE_PERCENT || difficultyScore + 1e-7 < thresholdScore) return;
      climbs.push({ startDistance: start.distanceKm, endDistance: summit.distanceKm, startElevation: start.elevationM, summitElevation: summit.elevationM, distanceKm, elevationGain, averageGradePercent, difficultyScore });
    };
    for (let i = 1; i < run.length; i++) {
      const p = run[i], previous = run[i - 1];
      const grade = (p.elevationM - previous.elevationM) / ((p.distanceKm - previous.distanceKm) * 10);
      if (!active) {
        if (p.elevationM <= run[valley].elevationM) valley = i;
        if (grade >= C.CLIMB_MIN_TREND_GRADE_PERCENT && p.elevationM - run[valley].elevationM >= C.CLIMB_START_GAIN_M) { active = true; peak = i; trough = i; pause = null; }
        continue;
      }
      if (grade < C.CLIMB_MIN_TREND_GRADE_PERCENT && pause === null) pause = peak;
      if (p.elevationM > run[peak].elevationM) { peak = i; trough = i; }
      else if (p.elevationM < run[trough].elevationM) trough = i;
      if (pause !== null && p.elevationM - run[pause].elevationM > C.CLIMB_SUMMIT_PLATEAU_MAX_GAIN_M) pause = null;
      const drop = run[peak].elevationM - p.elevationM;
      const dipDistance = (p.distanceKm - run[peak].distanceKm) * 1000;
      const plateau = pause !== null && grade < C.ABSOLUTE_MIN_AVG_GRADE_PERCENT && (p.distanceKm - run[pause].distanceKm) * 1000 >= C.CLIMB_SUMMIT_PLATEAU_DISTANCE_M;
      const excessiveDip = drop > C.CLIMB_SUMMIT_DROP_M || drop > C.CLIMB_MAX_DIP_ELEVATION_M || (drop > C.CLIMB_NOISE_DIP_M && dipDistance > C.CLIMB_MAX_DIP_DISTANCE_M);
      if (plateau || excessiveDip) { emit(); active = false; valley = trough; pause = null; }
    }
    if (active) emit();
  }
  return climbs;
}

/** Refilter cached candidates only; neither GPX parsing nor smoothing is repeated. */
export function applyClimbSettings(route: Route, settings: C.ClimbSettings): Route {
  const threshold = getClimbThresholdForSettings(settings);
  return { ...route, climbs: route.climbCandidates.filter(climb => climb.difficultyScore + 1e-7 >= threshold) };
}

/** Binary lookup/interpolation of ORIGINAL GPX elevations, with no GPS altitude. */
function elevationAt(route: Route, distance: number): number | null {
  let lo = 0, hi = route.points.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (route.points[mid].distance <= distance) lo = mid + 1; else hi = mid; }
  const a = route.points[lo - 1], b = route.points[lo];
  if (!a || a.elevation === null) return null;
  if (a.distance === distance) return a.elevation;
  if (!b || b.elevation === null || b.distance <= a.distance) return null;
  return a.elevation + (b.elevation - a.elevation) * (distance - a.distance) / (b.distance - a.distance);
}
export function getCurrentClimbStatus(route: Route, currentDistance: number | null, settings: C.ClimbSettings = C.DEFAULT_CLIMB_SETTINGS): ClimbStatus | null {
  if (currentDistance === null || !Number.isFinite(currentDistance)) return null;
  let lo = 0, hi = route.climbs.length;
  while (lo < hi) { const mid = (lo + hi) >>> 1; if (route.climbs[mid].endDistance <= currentDistance) lo = mid + 1; else hi = mid; }
  const climb = route.climbs[lo];
  if (!climb || currentDistance < climb.startDistance || currentDistance >= climb.endDistance || climb.difficultyScore + 1e-7 < getClimbThresholdForSettings(settings)) return null;
  const elevation = elevationAt(route, currentDistance);
  if (elevation === null) return null;
  const remainingDistance = climb.endDistance - currentDistance;
  const remainingGain = climb.summitElevation - elevation;
  return remainingDistance * 1000 > C.MIN_REMAINING_CLIMB_DISTANCE_M + 1e-7 && remainingGain > C.MIN_REMAINING_CLIMB_GAIN_M + 1e-7 ? { climb, remainingDistance, remainingGain } : null;
}
