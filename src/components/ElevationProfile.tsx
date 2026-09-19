import { useLanguage } from '../i18n/language';
import { memo, useMemo, useRef, useState } from 'react';
import { PanResponder, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { Route, RoutePosition } from '../models/route';
export const ElevationProfile = memo(function ElevationProfile({ route, current, selected, onSelect }: {
    route: Route;
    current: RoutePosition | null;
    selected: RoutePosition | null;
    onSelect: (distance: number) => void;
}) {
    const { t, n } = useLanguage();
    const [width, setWidth] = useState(320);
    const left = 40, right = width - 12, top = 10, bottom = 88;
    const min = route.minElevation ?? 0, max = route.maxElevation ?? 0;
    const span = Math.max(max - min, 1);
    const x = (distance: number) => left + distance / (route.totalDistance || 1) * (right - left);
    const y = (elevation: number) => max === min ? (top + bottom) / 2 : bottom - (elevation - min) / span * (bottom - top);
    const start = useRef(0);
    const responder = useMemo(() => {
        const select = (px: number) => onSelect(Math.max(0, Math.min(1, (px - left) / Math.max(1, right - left))) * route.totalDistance);
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (event) => { start.current = event.nativeEvent.locationX; select(start.current); },
            onPanResponderMove: (_event, gesture) => select(start.current + gesture.dx),
            onPanResponderTerminationRequest: () => false,
        });
    }, [onSelect, right, route.totalDistance]);
    const path = useMemo(() => {
        const commands: string[] = [];
        for (const segment of route.segments) {
            let move = true;
            for (const p of segment.points) {
                if (p.elevation === null) {
                    move = true;
                    continue;
                }
                const px = left + p.distance / (route.totalDistance || 1) * (right - left);
                const py = max === min ? (top + bottom) / 2 : bottom - (p.elevation - min) / span * (bottom - top);
                commands.push(`${move ? 'M' : 'L'}${px.toFixed(2)},${py.toFixed(2)}`);
                move = false;
            }
        }
        return commands.join(' ');
    }, [route, right, max, min, span]);
    return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}><Text style={{ fontWeight: '700', color: '#173f36' }}>{t("Профиль высоты")}</Text><Text style={{ color: '#637770', fontSize: 11 }}>{t("Проведите по графику")}</Text></View>
    <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={t("Выбранная точка на профиле высоты")} accessibilityValue={{ min: 0, max: route.totalDistance, now: selected?.distance ?? 0 }} accessibilityActions={[{ name: 'increment', label: t("Вперёд") }, { name: 'decrement', label: t("Назад") }]} onAccessibilityAction={(event) => onSelect((selected?.distance ?? 0) + (event.nativeEvent.actionName === 'increment' ? 1 : -1) * route.totalDistance / 100)}>
      <Svg pointerEvents="none" width={width} height={112}>
        {[top, (top + bottom) / 2, bottom].map((py) => <Line key={py} x1={left} x2={right} y1={py} y2={py} stroke="#e2eae5"/>)}
        <SvgText x={0} y={top + 5} fontSize={10} fill="#637770">{Math.round(max)}{' '}{t("м")}</SvgText>
        <SvgText x={0} y={bottom} fontSize={10} fill="#637770">{Math.round(min)}{' '}{t("м")}</SvgText>
        <Path d={path} fill="none" stroke="#197251" strokeWidth={2.5}/>
        {route.minElevation === null && <SvgText x={width / 2} y={48} textAnchor="middle" fontSize={12} fill="#637770">{t("В GPX нет высот")}</SvgText>}
        {current && <Line x1={x(current.distance)} x2={x(current.distance)} y1={top} y2={bottom} stroke="#2679e8" strokeWidth={2}/>}
        {selected && <><Line x1={x(selected.distance)} x2={x(selected.distance)} y1={top} y2={bottom} stroke="#e88425" strokeWidth={2} strokeDasharray="4 3"/><Circle cx={x(selected.distance)} cy={selected.elevation === null ? bottom : y(selected.elevation)} r={5} fill="#e88425" stroke="white" strokeWidth={2}/></>}
        <SvgText x={left} y={107} fontSize={10} fill="#637770">{t("0 км")}</SvgText>
        <SvgText x={right} y={107} textAnchor="end" fontSize={10} fill="#637770">{n(route.totalDistance)}{' '}{t("км")}</SvgText>
      </Svg>
    </View>
  </View>;
});
