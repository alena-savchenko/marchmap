import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GPSPosition, Route, RoutePosition } from '../models/route';
import { parseGPX, validateGPXFile } from '../services/gpx';
import { currentRoutePosition, positionAtDistance, ROUTE_THRESHOLD_METERS, snapToRoute } from '../services/route';
import { getCurrentLocation } from '../services/location';
import { RouteMap } from '../components/RouteMap';
import { RouteStats } from '../components/RouteStats';
import { ElevationProfile } from '../components/ElevationProfile';
import { Icon } from '../components/Icon';
import { emptyPreparation, mapModes, preparationLabels, type MapMode } from '../services/mapPolicy';
import { loadMapMode, saveMapMode } from '../services/settings';
import { OfflineController } from '../services/offline';
import appConfig from '../../app.json';

export function RouteScreen() {
  const [route, setRoute] = useState<Route | null>(null);
  const [routeVersion, setRouteVersion] = useState(0);
  const [selected, setSelected] = useState<RoutePosition | null>(null);
  const [focus, setFocus] = useState<RoutePosition | null>(null);
  const [gps, setGPS] = useState<GPSPosition | null>(null);
  const [busy, setBusy] = useState<'file' | 'gps' | null>(null);
  const [settings, setSettings] = useState(false);
  const [mode, setMode] = useState(loadMapMode);
  const [preparation, setPreparation] = useState(emptyPreparation);
  const controller = useMemo(() => new OfflineController(setPreparation), []);
  useEffect(() => { void controller.configure(mode, route); }, [controller, mode, route]);
  useEffect(() => () => { void controller.dispose(); }, [controller]);
  const locked = useRef(false);
  const current = useMemo(() => route && gps ? currentRoutePosition(route, gps) : null, [route, gps]);
  const selectDistance = useCallback((distance: number) => {
    if (route) { const point = positionAtDistance(route, distance); setSelected(point); setFocus(point); }
  }, [route]);
  async function perform(kind: 'file' | 'gps', task: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(kind);
    try { await task(); } catch (err) { Alert.alert('Не удалось выполнить действие', err instanceof Error ? err.message : 'Попробуйте ещё раз.'); }
    finally { locked.current = false; setBusy(null); }
  }
  const open = () => perform('file', async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    const file = new File(asset.uri);
    try {
      validateGPXFile(asset.name, file.size);
      const next = parseGPX(await file.text(), asset.name.replace(/\.gpx$/i, ''));
      setRoute(next); setSelected(null); setFocus(null); setRouteVersion((version) => version + 1);
    } finally { try { if (file.exists) file.delete(); } catch { /* Cache cleanup must not obscure an import result. */ } }
  });
  const locate = () => perform('gps', async () => {
    const next = await getCurrentLocation();
    if (AppState.currentState === 'active') setGPS(next);
  });
  function changeMode(next: MapMode) {
    try { saveMapMode(next); setMode(next); }
    catch { Alert.alert('Настройки не сохранены', 'Не удалось записать режим карты в память телефона.'); }
  }
  const displayed = selected ?? current ?? (route ? positionAtDistance(route, 0) : null);
  const statusText = `Офлайн-карта: ${preparationLabels[preparation.state].toLowerCase()}${preparation.state === 'loading' ? ` · ${Math.floor(preparation.percentage)}%` : ''}`;
  return <SafeAreaView style={styles.safe}>
    <View style={styles.toolbar}>
      <View accessibilityLabel="MarchMap" style={styles.brand}><Icon name="mountain" size={32} /></View>
      <View style={styles.spacer} />
      <Pressable accessibilityRole="button" accessibilityLabel="Настройки карты" onPress={() => setSettings(true)} style={styles.iconButton}><Icon name="settings" /></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Открыть GPX" disabled={!!busy} onPress={open} style={[styles.iconButton, styles.add]}>{busy === 'file' ? <ActivityIndicator color="white" /> : <Icon name="plus" color="white" />}</Pressable>
    </View>
    {!route ? <View style={styles.empty}>
      <Icon name="mountain" size={90} />
      <Text style={styles.emptyTitle}>Дальше, чем просто маршрут</Text>
      <Text style={styles.description}>Добавьте GPX через + в правом углу.{ '\n' }Карта, высоты и выбранная точка —{ '\n' }всё на одном экране.</Text>
      <Text style={styles.modeHint}>{mapModes.find((item) => item.value === mode)?.title}</Text>
    </View> : <>
      <View style={styles.mapArea}>
        <RouteMap key={routeVersion} route={route} gps={gps} current={current} selected={selected} focus={focus} onSelect={(p) => { setSelected(snapToRoute(route, p)); setFocus(null); }} />
        <Pressable accessibilityRole="button" accessibilityLabel="Получить текущее местоположение" disabled={!!busy} onPress={locate} style={[styles.iconButton, styles.location]}>{busy === 'gps' ? <ActivityIndicator color="#155847" /> : <Icon name="location" />}</Pressable>
      </View>
      <View style={styles.panel}>
        <View style={styles.routeRow}><Icon name="mountain" size={28} /><View style={styles.spacer}><Text numberOfLines={1} style={styles.routeName}>{route.name}</Text><Text style={styles.hint}>GPX · {route.totalDistance.toFixed(1)} км · {route.points.length} точек</Text></View></View>
        <Pressable accessibilityRole="button" onPress={() => setSettings(true)} style={styles.status}><View style={[styles.statusDot, { backgroundColor: preparation.state === 'ready' ? '#23906a' : preparation.state === 'error' || preparation.state === 'partial' ? '#df882c' : '#94aaa0' }]} /><Text numberOfLines={1} style={styles.hint}>{mode === 'online' ? 'Карта онлайн' : statusText}</Text></Pressable>
        {displayed && <RouteStats title={selected ? '● Выбранная точка' : current ? '● Вы на маршруте' : 'Старт маршрута'} color={selected ? '#c26a17' : current ? '#2679e8' : '#155847'} position={displayed} />}
        <View style={styles.gpsRow}><Text numberOfLines={1} style={[styles.hint, styles.spacer]}>{gps ? current ? `GPS · ${current.distance.toFixed(1)} км · ${current.elevation === null ? '—' : Math.round(current.elevation) + ' м'} · ±${gps.accuracy === null ? '—' : Math.round(gps.accuracy)} м` : `GPS: дальше ${ROUTE_THRESHOLD_METERS} м от маршрута` : 'Нажмите ⊙ для определения положения'}</Text>{selected && <Pressable accessibilityRole="button" onPress={() => { setSelected(null); setFocus(null); }} hitSlop={8}><Text style={styles.reset}>Сбросить</Text></Pressable>}</View>
        <ElevationProfile route={route} current={current} selected={selected} onSelect={selectDistance} />
        <Text style={styles.legend}>● Синий — GPS   ·   ● Оранжевый — выбор на карте / графике</Text>
      </View>
    </>}
    <Modal visible={settings} animationType="slide" onRequestClose={() => setSettings(false)}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.toolbar}><Text style={styles.settingsTitle}>Карта</Text><View style={styles.spacer} /><Pressable accessibilityRole="button" accessibilityLabel="Закрыть настройки" onPress={() => setSettings(false)} style={styles.iconButton}><Icon name="close" /></Pressable></View>
        <ScrollView contentContainerStyle={styles.settingsContent}>
          <Text style={styles.sectionTitle}>Режим карты</Text>
          {mapModes.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: mode === item.value }} onPress={() => changeMode(item.value)} style={styles.option}><View style={[styles.radio, mode === item.value && styles.radioSelected]}>{mode === item.value && <View style={styles.radioDot} />}</View><View style={styles.spacer}><Text style={styles.optionTitle}>{item.title}</Text><Text style={styles.descriptionSmall}>{item.description}</Text></View></Pressable>)}
          <View style={styles.offlineCard}>
            <Text style={styles.sectionTitle}>{statusText}</Text>
            {route && <Text style={styles.descriptionSmall}>{route.name}</Text>}
            <View style={styles.progressTrack}><View style={[styles.progress, { width: `${preparation.percentage}%` }]} /></View>
            <Text style={styles.descriptionSmall}>{Math.floor(preparation.percentage)}% · {(preparation.bytes / 1024 / 1024).toFixed(1)} МБ ресурсов</Text>
            <Text style={styles.descriptionSmall}>{preparation.message ?? (preparation.state === 'ready' ? 'Область маршрута сохранена на телефоне.' : route ? 'Область маршрута с запасом около 1 км, масштабы 0–14. Более крупный масштаб использует те же векторные данные.' : 'Добавьте GPX для подготовки области маршрута.')}</Text>
            {mode !== 'online' && route && preparation.state !== 'loading' && preparation.state !== 'ready' && <Pressable accessibilityRole="button" style={styles.retry} onPress={() => { void controller.configure(mode, route); }}><Text style={styles.retryText}>Повторить загрузку</Text></Pressable>}
            {preparation.state === 'loading' && <Text style={styles.descriptionSmall}>Оставьте приложение открытым до завершения подготовки.</Text>}
          </View>
          <Text style={styles.descriptionSmall}>Выбор сохраняется между запусками. Переключение режима не удаляет текущий GPX или скачанные области. При повторном импорте той же области используется готовая карта.</Text>
          <Text style={styles.hint}>MarchMap · {appConfig.expo.version}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fbfcfa' }, toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 62 }, brand: { padding: 4 }, spacer: { flex: 1 }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#edf3ee' }, add: { backgroundColor: '#155847' }, mapArea: { flex: 1, minHeight: 100 }, location: { position: 'absolute', right: 14, top: 14, backgroundColor: '#fff', elevation: 4 },
  panel: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8, backgroundColor: '#fbfcfa', borderTopLeftRadius: 24, borderTopRightRadius: 24 }, routeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, routeName: { fontSize: 16, fontWeight: '700', color: '#172f2a' }, hint: { fontSize: 11, color: '#637770' }, status: { flexDirection: 'row', gap: 6, alignItems: 'center' }, statusDot: { width: 6, height: 6, borderRadius: 3 }, gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 }, reset: { color: '#155847', fontSize: 12, fontWeight: '600', paddingVertical: 6 }, legend: { color: '#637770', fontSize: 9, textAlign: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24, backgroundColor: '#f0f5ef' }, emptyTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: '#173f36' }, description: { fontSize: 16, lineHeight: 25, color: '#637770', textAlign: 'center' }, modeHint: { color: '#155847', fontSize: 12, marginTop: 30 }, settingsTitle: { fontSize: 22, fontWeight: '700', color: '#172f2a' }, settingsContent: { padding: 22, gap: 18 }, sectionTitle: { fontSize: 16, fontWeight: '700', color: '#172f2a' }, option: { flexDirection: 'row', gap: 14, paddingVertical: 10 }, radio: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: '#97a69f', alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: '#157151' }, radioDot: { width: 15, height: 15, borderRadius: 8, backgroundColor: '#157151' }, optionTitle: { fontSize: 16, color: '#172f2a', marginBottom: 5 }, descriptionSmall: { fontSize: 13, color: '#637770', lineHeight: 20 }, offlineCard: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#dce6de', gap: 12 }, progressTrack: { height: 6, backgroundColor: '#e1ebe5', borderRadius: 3, overflow: 'hidden' }, progress: { height: 6, backgroundColor: '#399e76' }, retry: { padding: 13, borderWidth: 1, borderColor: '#aac5b8', borderRadius: 12, alignItems: 'center' }, retryText: { color: '#155847', fontWeight: '600' },
});
