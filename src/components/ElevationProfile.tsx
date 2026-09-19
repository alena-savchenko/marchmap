import { memo, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import type { Route, RoutePosition } from '../models/route';
export const ElevationProfile = memo(function ElevationProfile({ route, current, selected }: { route: Route; current: RoutePosition | null; selected: RoutePosition | null }) {
  const [width, setWidth] = useState(320);
  const left = 44, right = width - 16, top = 18, bottom = 136;
  const min = route.minElevation ?? 0, max = route.maxElevation ?? 0;
  const span = Math.max(max - min, 1);
  const x = (distance: number) => left + distance / (route.totalDistance || 1) * (right - left);
  const path = useMemo(() => {
    const commands: string[] = [];
    for (const segment of route.segments) {
      let move = true;
      for (const p of segment.points) {
        if (p.elevation === null) { move = true; continue; }
        const px = left + p.distance / (route.totalDistance || 1) * (right - left);
        const py = max === min ? (top + bottom) / 2 : bottom - (p.elevation - min) / span * (bottom - top);
        commands.push(`${move ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`);
        move = false;
      }
    }
    return commands.join(' ');
  }, [route, right, max, min, span]);
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <Text style={{ fontWeight: '700', marginBottom: 4 }}>Профиль высоты</Text>
    {route.minElevation === null ? <Text>В GPX нет данных высоты.</Text> : <Svg width={width} height={170} accessibilityLabel="График высоты по расстоянию от старта">
      <Line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#aab8bf" />
      <SvgText x={2} y={top + 4} fontSize={11} fill="#53646c">{Math.round(max)} м</SvgText>
      <SvgText x={2} y={bottom} fontSize={11} fill="#53646c">{Math.round(min)} м</SvgText>
      <Path d={path} fill="none" stroke="#256d60" strokeWidth={2} />
      {current && <Line x1={x(current.distance)} x2={x(current.distance)} y1={top} y2={bottom} stroke="#087e9c" strokeWidth={3} />}
      {selected && <Line x1={x(selected.distance)} x2={x(selected.distance)} y1={top} y2={bottom} stroke="#ab4a10" strokeWidth={2} strokeDasharray="5 3" />}
      <SvgText x={left} y={158} fontSize={11}>0 км</SvgText>
      <SvgText x={right} y={158} textAnchor="end" fontSize={11}>{route.totalDistance.toFixed(1)} км</SvgText>
    </Svg>}
    <Text style={{ color: '#53646c', fontSize: 12 }}>Синий — текущая точка · оранжевый — выбранная</Text>
  </View>;
});
