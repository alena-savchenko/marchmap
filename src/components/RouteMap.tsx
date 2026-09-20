import { useTheme } from '../theme/theme';
import type { Colors } from '../theme/core';
import { useLanguage } from '../i18n/language';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef, type LngLatBounds } from '@maplibre/maplibre-react-native';
import { darkMapStyle, lightMapStyle } from '../theme/mapStyle';
import { Icon } from './Icon';
import type { FeatureCollection, LineString, Point } from 'geojson';
import type { Coordinate, GPSPosition, Route, RoutePosition } from '../models/route';
function Dot({ id, coordinate, color, radius = 7, stroke = '#ffffff' }: {
    id: string;
    coordinate: Coordinate;
    color: string;
    radius?: number;
    stroke?: string;
}) {
    return <GeoJSONSource id={id} data={{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [coordinate.lon, coordinate.lat] } }}>
    <Layer id={`${id}-dot`} type="circle" paint={{ 'circle-radius': radius, 'circle-color': color, 'circle-stroke-color': stroke, 'circle-stroke-width': 2 }}/>
  </GeoJSONSource>;
}
export function RouteMap({ route, gps, current, selected, focus, onSelect }: {
    route: Route;
    gps: GPSPosition | null;
    current: RoutePosition | null;
    selected: RoutePosition | null;
    focus: RoutePosition | null;
    onSelect: (p: Coordinate) => void;
}) {
    const { t } = useLanguage();
    const { colors: c, scheme } = useTheme();
    const [bearing, setBearing] = useState(0);
    const styles = makeStyles(c);
    const camera = useRef<CameraRef>(null);
    useEffect(() => { if (focus)
        camera.current?.jumpTo({ center: [focus.lon, focus.lat] }); }, [focus]);
    const [mapFailed, setMapFailed] = useState(false);
    const geometry = useMemo<FeatureCollection<LineString | Point>>(() => ({
        type: 'FeatureCollection',
        features: route.segments.map((segment) => segment.line ?? {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: [segment.points[0].lon, segment.points[0].lat] },
        }),
    }), [route]);
    const bounds = useMemo<LngLatBounds>(() => {
        const all: Coordinate[] = gps ? [...route.points, gps] : route.points;
        let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
        for (const p of all) {
            west = Math.min(west, p.lon);
            east = Math.max(east, p.lon);
            south = Math.min(south, p.lat);
            north = Math.max(north, p.lat);
        }
        return [west - 0.001, south - 0.001, east + 0.001, north + 0.001];
    }, [route, gps]);
    return <View style={styles.container}>
    <Map style={styles.map} mapStyle={scheme === 'dark' ? darkMapStyle : lightMapStyle} compass={false} onRegionIsChanging={event => setBearing(event.nativeEvent.bearing)} onRegionDidChange={event => setBearing(event.nativeEvent.bearing)} onDidFinishLoadingMap={() => setMapFailed(false)} onDidFailLoadingMap={() => setMapFailed(true)} onPress={(event) => onSelect({ lon: event.nativeEvent.lngLat[0], lat: event.nativeEvent.lngLat[1] })}>
      <Camera ref={camera} key={gps?.timestamp ?? 'route'} initialViewState={{ bounds, padding: { top: 32, bottom: 32, left: 32, right: 32 } }}/>
      <GeoJSONSource id="route" data={geometry}>
        <Layer id="route-line" type="line" filter={['==', ['geometry-type'], 'LineString']} paint={{ 'line-color': c.route, 'line-width': 5 }} layout={{ 'line-cap': 'round', 'line-join': 'round' }}/>
        <Layer id="route-singletons" type="circle" filter={['==', ['geometry-type'], 'Point']} paint={{ 'circle-color': c.route, 'circle-radius': 4 }}/>
      </GeoJSONSource>
      <Dot id="start" coordinate={route.points[0]} color="#258044"/>
      <Dot id="finish" coordinate={route.points[route.points.length - 1]} color="#a32746"/>
      {gps && <Dot id="gps" coordinate={gps} color="#2463eb" radius={9}/>}
      {current && <Dot id="current" coordinate={current} color="transparent" stroke="#087e9c" radius={13}/>}
      {selected && <Dot id="selected" coordinate={selected} color="#ab4a10" radius={8}/>}
    </Map>
    <Pressable accessibilityRole="button" accessibilityLabel={t("Север сверху")} onPress={() => { void camera.current?.setStop({ bearing: 0, pitch: 0, duration: 250 }); }} style={{ position: 'absolute', top: 68, right: 14, width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center' }}><View style={{ transform: [{ rotate: `${-bearing}deg` }] }}><Icon name="compass" /></View></Pressable>
    {mapFailed && <Text style={styles.notice}>{t("Подложка недоступна. Статус загрузки — в настройках.")}</Text>}
  </View>;
}
const makeStyles = (c: Colors) => StyleSheet.create({ container: { flex: 1, overflow: 'hidden', backgroundColor: c.empty }, map: { flex: 1 }, notice: { color: c.text, position: 'absolute', top: 8, left: 8, right: 64, padding: 8, backgroundColor: c.surface, fontSize: 11 } });
