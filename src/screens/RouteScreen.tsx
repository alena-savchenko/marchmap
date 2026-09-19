import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Button, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GPSPosition, Route, RoutePosition } from '../models/route';
import { parseGPX } from '../services/gpx';
import { currentRoutePosition, ROUTE_THRESHOLD_METERS, snapToRoute } from '../services/route';
import { getCurrentLocation } from '../services/location';
import { RouteMap } from '../components/RouteMap';
import { RouteStats } from '../components/RouteStats';
import { ElevationProfile } from '../components/ElevationProfile';
import appConfig from '../../app.json';
export function RouteScreen() {
  const [route, setRoute] = useState<Route | null>(null);
  const [routeVersion, setRouteVersion] = useState(0);
  const [selected, setSelected] = useState<RoutePosition | null>(null);
  const [gps, setGPS] = useState<GPSPosition | null>(null);
  const [busy, setBusy] = useState<'file' | 'gps' | null>(null);
  const locked = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const current = useMemo(() => route && gps ? currentRoutePosition(route, gps) : null, [route, gps]);
  async function perform(kind: 'file' | 'gps', task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(kind); setError(null);
    try { await task(); } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось выполнить действие.'); }
    finally { locked.current = false; setBusy(null); }
  }
  const open = () => perform('file', async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    const file = new File(asset.uri);
    try {
      if (!asset.name.toLowerCase().endsWith('.gpx')) throw new Error('Выберите файл с расширением .gpx.');
      if (file.size > 25 * 1024 * 1024) throw new Error('Для MVP выберите GPX размером до 25 МБ.');
      const next = parseGPX(await file.text(), asset.name.replace(/\.gpx$/i, ''));
      setRoute(next); setSelected(null); setRouteVersion((version) => version + 1);
    } finally { if (file.exists) file.delete(); }
  });
  const locate = () => perform('gps', async () => {
    const next = await getCurrentLocation();
    if (AppState.currentState === 'active') setGPS(next);
  });
  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={[styles.content, !route && styles.empty]}>
      <Text style={styles.heading}>{appConfig.expo.name}</Text>
      <Text style={styles.hint}>Версия {appConfig.expo.version}</Text>
      {!route ? <View style={styles.intro}>
        <Text style={styles.title}>Ваш маршрут из GPX</Text>
        <Text style={styles.text}>Откройте файл, чтобы увидеть маршрут и профиль высоты. Файл обрабатывается только на устройстве.</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!busy }} onPress={open} disabled={!!busy} style={({ pressed }) => ({ minHeight: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#256d60', opacity: busy || pressed ? 0.6 : 1 })}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>Открыть GPX</Text>
        </Pressable>
      </View> : <>
        <View style={styles.toolbar}><Text style={styles.title}>{route.name}</Text><Button title="Открыть GPX" onPress={open} disabled={!!busy} /></View>
        <Text>{route.totalDistance.toFixed(1)} км · {route.points.length} точек · {route.segments.length} сегм.</Text>
        <RouteMap key={routeVersion} route={route} gps={gps} current={current} selected={selected} onSelect={(p) => setSelected(snapToRoute(route, p))} />
        <Text style={styles.hint}>Тапните по карте рядом с маршрутом для выбора точки. Зелёный — старт, бордовый — финиш; синий круг — GPS.</Text>
        <Button title={busy === 'gps' ? 'Определяем положение…' : 'Получить текущее положение'} onPress={locate} disabled={!!busy} color="#256d60" />
        {gps && <Text style={styles.hint}>GPS: {new Date(gps.timestamp).toLocaleTimeString()} · точность {gps.accuracy === null ? 'неизвестна' : `±${Math.round(gps.accuracy)} м`}. Обновление по кнопке.</Text>}
        {current && <RouteStats title="Текущая точка на маршруте" color="#087e9c" position={current} />}
        {gps && !current && <Text>Вы дальше {ROUTE_THRESHOLD_METERS} м от маршрута. Прогресс не рассчитан.</Text>}
        {selected && <><RouteStats title="Выбранная точка" color="#ab4a10" position={selected} /><Button title="Сбросить выбор" onPress={() => setSelected(null)} /></>}
        <ElevationProfile route={route} current={current} selected={selected} />
      </>}
      {busy && <ActivityIndicator accessibilityLabel="Загрузка" color="#256d60" />}
      {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#fff' }, content: { padding: 16, gap: 12 }, empty: { flexGrow: 1, justifyContent: 'center' }, heading: { fontSize: 26, fontWeight: '800', color: '#20343e' }, intro: { gap: 20 }, title: { fontSize: 18, fontWeight: '700', flexShrink: 1 }, text: { fontSize: 16, lineHeight: 24, color: '#53646c' }, toolbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, hint: { color: '#53646c', fontSize: 12 }, error: { color: '#b42318', padding: 12, backgroundColor: '#fff0ed' } });
