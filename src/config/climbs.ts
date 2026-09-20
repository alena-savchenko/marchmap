export const CLIMB_RESAMPLE_DISTANCE_M = 25;
export const CLIMB_SMOOTHING_WINDOW_M = 100;
export const CLIMB_MIN_TREND_GRADE_PERCENT = 0.5;
export const CLIMB_START_GAIN_M = 5;
export const CLIMB_NOISE_DIP_M = 2;
export const CLIMB_MAX_DIP_DISTANCE_M = 200;
export const CLIMB_MAX_DIP_ELEVATION_M = 15;
export const CLIMB_SUMMIT_DROP_M = 20;
export const CLIMB_SUMMIT_PLATEAU_DISTANCE_M = 250;
export const CLIMB_SUMMIT_PLATEAU_MAX_GAIN_M = 8;
export const ABSOLUTE_MIN_CLIMB_DISTANCE_M = 250;
export const ABSOLUTE_MIN_CLIMB_GAIN_M = 30;
export const ABSOLUTE_MIN_AVG_GRADE_PERCENT = 3;
export const MIN_REMAINING_CLIMB_DISTANCE_M = 100;
export const MIN_REMAINING_CLIMB_GAIN_M = 10;
export type ClimbSensitivityPreset = { id: 'high' | 'medium' | 'low'; thresholdScore: number };
export const CLIMB_PRESETS: readonly ClimbSensitivityPreset[] = [
  { id: 'high', thresholdScore: 20 }, { id: 'medium', thresholdScore: 40 }, { id: 'low', thresholdScore: 80 },
];
export type ClimbSettings = { preset: ClimbSensitivityPreset['id'] | 'custom'; customGrade: number; customDistanceM: number };
export const DEFAULT_CLIMB_SETTINGS: ClimbSettings = { preset: 'medium', customGrade: 6, customDistanceM: 800 };
export const CUSTOM_GRADE_RANGE = [1, 30] as const;
export const CUSTOM_DISTANCE_RANGE_M = [250, 50000] as const;
export const CLIMB_PREVIEW_GRADES = [4, 6, 8, 10, 12] as const;
export const CLIMB_PREVIEW_ROUNDING_M = 50;
