import { expect, it } from 'vitest';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { dark, light, parseTheme, resolveTheme } from './core';
import { darkMapStyle, lightMapStyle } from './mapStyle';
it('follows system changes and respects explicit overrides', () => {
  expect(resolveTheme('system', 'dark')).toBe('dark');
  expect(resolveTheme('system', 'light')).toBe('light');
  expect(resolveTheme('system', null)).toBe('light');
  expect(resolveTheme('light', 'dark')).toBe('light');
  expect(resolveTheme('dark', 'light')).toBe('dark');
  expect(parseTheme('bad')).toBe('system');
});
it('uses valid map styles with identical offline resource references', () => {
  expect(validateStyleMin(lightMapStyle)).toEqual([]);
  expect(validateStyleMin(darkMapStyle)).toEqual([]);
  expect(darkMapStyle.sources).toEqual(lightMapStyle.sources);
  expect(darkMapStyle.sprite).toEqual(lightMapStyle.sprite);
  expect(darkMapStyle.glyphs).toEqual(lightMapStyle.glyphs);
  expect(darkMapStyle.layers.map(l => l.layout)).toEqual(lightMapStyle.layers.map(l => l.layout));
  expect(darkMapStyle.layers[0].paint).not.toEqual(lightMapStyle.layers[0].paint);
});
function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
it('keeps main, secondary and action text legible in both palettes', () => {
  for (const palette of [light, dark]) for (const foreground of [palette.text, palette.muted, palette.accent]) for (const background of [palette.background, palette.surface]) {
    const a = luminance(foreground), b = luminance(background);
    expect((Math.max(a,b) + .05) / (Math.min(a,b) + .05)).toBeGreaterThanOrEqual(4.5);
  }
});
