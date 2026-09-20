import type { StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import liberty from './liberty.json';
// Pinned OpenFreeMap Liberty style. Both palettes share every resource URL so
// changing appearance works with the existing offline pack, without fetching a new style.
export const lightMapStyle = liberty as unknown as StyleSpecification;
export const darkMapStyle: StyleSpecification = {
  ...lightMapStyle,
  layers: lightMapStyle.layers.map(layer => {
    const paint: Record<string, unknown> = { ...layer.paint };
    for (const key of Object.keys(paint)) {
      if (!key.endsWith('color')) continue;
      paint[key] = key === 'text-color' ? '#c7d6d1' : key === 'text-halo-color' ? '#17231f'
        : /water/.test(layer.id) ? '#193d50' : /park|wood|grass|forest/.test(layer.id) ? '#243d30'
        : /building/.test(layer.id) ? '#394640' : /motorway|trunk/.test(layer.id) ? '#8b7857'
        : /road|street|bridge|tunnel|transport/.test(layer.id) ? '#53635b'
        : layer.type === 'line' ? '#52655c' : '#1c2b25';
    }
    if (layer.type === 'raster') { paint['raster-brightness-max'] = 0.25; paint['raster-saturation'] = -0.6; }
    return { ...layer, paint } as typeof layer;
  }),
};
