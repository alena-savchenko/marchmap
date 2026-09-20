import { SelectField } from '../components/SelectField';
import { useTheme } from '../theme/theme';
import type { Colors } from '../theme/core';
import { useLanguage } from '../i18n/language';
import { useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { GPSPosition, Route, RoutePosition } from '../models/route';
import { validateGPXFile } from '../services/gpx';
import { createRouteLibrary } from '../services/routeStorage';
import type { SavedRoute } from '../services/routeLibrary';
import { incomingFiles } from '../services/incoming';
import { RouteLibraryModal } from '../components/RouteLibraryModal';
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
    const { t, n, errorText, preference, setPreference } = useLanguage();
    const { colors: c, preference: themePreference, setPreference: setTheme } = useTheme();
    const styles = makeStyles(c);
    const [route, setRoute] = useState<Route | null>(null);
    const [routeVersion, setRouteVersion] = useState(0);
    const [selected, setSelected] = useState<RoutePosition | null>(null);
    const [focus, setFocus] = useState<RoutePosition | null>(null);
    const [gps, setGPS] = useState<GPSPosition | null>(null);
    const [busy, setBusy] = useState<'file' | 'gps' | 'cache' | null>(null);
    const [store] = useState(createRouteLibrary);
    const [library, setLibrary] = useState(() => store.snapshot());
    const [libraryVisible, setLibraryVisible] = useState(false);
    const [restored, setRestored] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [settings, setSettings] = useState(false);
    const [mode, setMode] = useState(loadMapMode);
    const [preparation, setPreparation] = useState(emptyPreparation);
    const controller = useMemo(() => new OfflineController(setPreparation), []);
    useEffect(() => { void controller.configure(mode, route, !library.mapsCleared); }, [controller, mode, route, library.mapsCleared]);
    useEffect(() => () => { void controller.dispose(); }, [controller]);
    const locked = useRef(false);
    const current = useMemo(() => route && gps ? currentRoutePosition(route, gps) : null, [route, gps]);
    const selectDistance = useCallback((distance: number) => {
        if (route) {
            const point = positionAtDistance(route, distance);
            setSelected(point);
            setFocus(point);
        }
    }, [route]);
    async function perform(kind: 'file' | 'gps' | 'cache', task: () => Promise<void>) {
        if (locked.current)
            return;
        locked.current = true;
        setBusy(kind);
        try {
            await task();
        }
        catch (err) {
            Alert.alert(t("Не удалось выполнить действие"), errorText(err));
        }
        finally {
            locked.current = false;
            setBusy(null);
        }
    }
    function activate(next: Route | null) {
        setRoute(next);
        setSelected(null);
        setFocus(null);
        setRouteVersion((version) => version + 1);
        setLibrary(store.snapshot());
    }
    const restoreLibrary = useEffectEvent(() => {
            try {
                const id = store.snapshot().activeId;
                if (id)
                    setRoute(store.open(id));
                setLibrary(store.snapshot());
            }
            catch (error) {
                Alert.alert(t("Маршрут не восстановлен"), errorText(error));
            }
            finally {
                setRestored(true);
            }
    });
    useEffect(() => {
        const timer = setTimeout(restoreLibrary, 0);
        return () => clearTimeout(timer);
    }, [store]);
    const handleIncoming = useEffectEvent(async () => {
        if (!restored || locked.current || AppState.currentState !== 'active')
            return;
        locked.current = true;
        let file: File | null = null;
        try {
            const incoming = await incomingFiles.takeFile();
            if (!incoming)
                return;
            setBusy('file');
            file = new File(incoming.uri);
            const next = store.import(await file.text(), incoming.name, file.size);
            activate(next);
            setLibraryVisible(false);
            setSettings(false);
        }
        catch (error) {
            Alert.alert(t("Не удалось открыть GPX"), errorText(error));
        }
        finally {
            try {
                if (file?.exists)
                    file.delete();
            }
            catch { /* Temporary copy only. */ }
            locked.current = false;
            setBusy(null);
        }
    });
    useEffect(() => {
        if (!restored)
            return;
        const timer = setInterval(() => { void handleIncoming(); }, 1000);
        return () => clearInterval(timer);
    }, [restored]);
    function openSaved(item: SavedRoute) {
        void perform('file', async () => { activate(store.open(item.id)); setLibraryVisible(false); });
    }
    function deleteSaved(item: SavedRoute) {
        Alert.alert(t("Удалить маршрут?"), item.name + t("\nИсходный GPX останется без изменений."), [
            { text: t("Отмена"), style: 'cancel' },
            { text: t("Удалить"), style: 'destructive', onPress: () => {
                    void perform('file', async () => {
                        const wasActive = store.snapshot().activeId === item.id;
                        const next = store.delete(item.id);
                        setLibrary(next);
                        if (wasActive) {
                            activate(null);
                            if (next.activeId)
                                activate(store.open(next.activeId));
                        }
                    });
                } },
        ]);
    }
    function clearMaps() {
        Alert.alert(t("Удалить все карты?"), t("Будут удалены скачанные области и кэш подложки. GPX-маршруты сохранятся. Повторная подготовка запускается кнопкой в настройках или новым импортом."), [
            { text: t("Отмена"), style: 'cancel' },
            { text: t("Удалить карты"), style: 'destructive', onPress: () => {
                    void perform('cache', async () => {
                        setLibrary(store.setMapsCleared(true));
                        setClearing(true);
                        // Unmount the renderer before modifying its native database.
                        await new Promise((resolve) => setTimeout(resolve, 100));
                        try {
                            await controller.clearCache(mode);
                            setRouteVersion((version) => version + 1);
                        }
                        finally {
                            setClearing(false);
                        }
                    });
                } },
        ]);
    }
    const open = () => perform('file', async () => {
        const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
        if (result.canceled)
            return;
        const asset = result.assets[0];
        const file = new File(asset.uri);
        try {
            validateGPXFile(asset.name, file.size);
            const next = store.import(await file.text(), asset.name, file.size);
            activate(next);
        }
        finally {
            try {
                if (file.exists)
                    file.delete();
            }
            catch { /* Cache cleanup must not obscure an import result. */ }
        }
    });
    const locate = () => perform('gps', async () => {
        const next = await getCurrentLocation();
        if (AppState.currentState === 'active')
            setGPS(next);
    });
    function changeMode(next: MapMode) {
        try {
            saveMapMode(next);
            setMode(next);
        }
        catch {
            Alert.alert(t("Настройки не сохранены"), t("Не удалось записать режим карты в память телефона."));
        }
    }
    const displayed = selected ?? current ?? (route ? positionAtDistance(route, 0) : null);
    const statusText = t("Офлайн-карта: {v0}{v1}", { v0: t(preparationLabels[preparation.state]), v1: preparation.state === 'loading' ? ` · ${Math.floor(preparation.percentage)}%` : '' });
    return <SafeAreaView style={styles.safe}>
    <View style={styles.toolbar}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Image source={require('../../assets/brand-symbol.png')} style={{ width: 48, height: 36 }} resizeMode="contain"/><Text numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1, fontSize: 23, fontWeight: '700', color: c.text }}>MarchMap</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Мои маршруты")} disabled={!!busy || !restored} onPress={() => setLibraryVisible(true)} style={styles.iconButton}><Icon name="folder"/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Настройки карты")} onPress={() => setSettings(true)} style={styles.iconButton}><Icon name="settings"/></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Открыть GPX")} disabled={!!busy || !restored} onPress={open} style={[styles.iconButton, styles.add]}>{busy === 'file' ? <ActivityIndicator color="white"/> : <Icon name="plus" color="white"/>}</Pressable>
    </View>
    {!route ? <View style={styles.empty}>
      <Icon name="mountain" size={90}/>
      <Text style={styles.emptyTitle}>{t("Дальше, чем просто маршрут")}</Text>
      <Text style={styles.description}>{t("Добавьте GPX через + в правом углу.")}{'\n'}{t("Карта, высоты и выбранная точка —")}{'\n'}{t("всё на одном экране.")}</Text>
      <Text style={styles.modeHint}>{t(mapModes.find((item) => item.value === mode)?.title ?? "")}</Text>
    </View> : <>
      <View style={styles.mapArea}>
        {!clearing && <RouteMap key={routeVersion} route={route} gps={gps} current={current} selected={selected} focus={focus} onSelect={(p) => { setSelected(snapToRoute(route, p)); setFocus(null); }}/>}
        <Pressable accessibilityRole="button" accessibilityLabel={t("Получить текущее местоположение")} disabled={!!busy} onPress={locate} style={[styles.iconButton, styles.location]}>{busy === 'gps' ? <ActivityIndicator color={c.accent}/> : <Icon name="location"/>}</Pressable>
      </View>
      <View style={styles.panel}>
        <View style={styles.routeRow}><Icon name="mountain" size={28}/><View style={styles.spacer}><Text numberOfLines={1} style={styles.routeName}>{route.name}</Text><Text style={styles.hint}>GPX · {n(route.totalDistance)}{' '}{t("км ·")}{' '}{route.points.length}{' '}{t("точек")}</Text></View></View>
        <Pressable accessibilityRole="button" onPress={() => setSettings(true)} style={styles.status}><View style={[styles.statusDot, { backgroundColor: preparation.state === 'ready' ? '#23906a' : preparation.state === 'error' || preparation.state === 'partial' ? '#df882c' : '#94aaa0' }]}/><Text numberOfLines={1} style={styles.hint}>{mode === 'online' ? t("Карта онлайн") : statusText}</Text></Pressable>
        {displayed && <RouteStats title={selected ? t("● Выбранная точка") : current ? t("● Вы на маршруте") : t("Старт маршрута")} color={selected ? c.orange : current ? c.blue : c.accent} position={displayed}/>}
        <View style={styles.gpsRow}><Text numberOfLines={1} style={[styles.hint, styles.spacer]}>{gps ? current ? t("GPS · {v0} км · {v1} · ±{v2} м", { v0: n(current.distance), v1: current.elevation === null ? '—' : Math.round(current.elevation) + t(" м"), v2: gps.accuracy === null ? '—' : Math.round(gps.accuracy) }) : t("GPS: дальше {v0} м от маршрута", { v0: ROUTE_THRESHOLD_METERS }) : t("Нажмите ⊙ для определения положения")}</Text>{selected && <Pressable accessibilityRole="button" onPress={() => { setSelected(null); setFocus(null); }} hitSlop={8}><Text style={styles.reset}>{t("Сбросить")}</Text></Pressable>}</View>
        <ElevationProfile route={route} current={current} selected={selected} onSelect={selectDistance}/>
        <Text style={styles.legend}>{t("● Синий — GPS   ·   ● Оранжевый — выбор на карте / графике")}</Text>
      </View>
    </>}
    <RouteLibraryModal visible={libraryVisible} library={library} disabled={!!busy} onClose={() => setLibraryVisible(false)} onOpen={openSaved} onDelete={deleteSaved}/>
    <Modal visible={settings} animationType="slide" onRequestClose={() => setSettings(false)}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.toolbar}><Text style={styles.settingsTitle}>{t("Карта")}</Text><View style={styles.spacer}/><Pressable accessibilityRole="button" accessibilityLabel={t("Закрыть настройки")} onPress={() => setSettings(false)} style={styles.iconButton}><Icon name="close"/></Pressable></View>
        <ScrollView contentContainerStyle={styles.settingsContent}>
          <Text style={styles.sectionTitle}>{t("Язык")}</Text>
          <SelectField label={t("Язык")} value={preference} options={[{ value: 'system', label: t("Как на устройстве") }, { value: 'ru', label: 'Русский' }, { value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }]} onChange={value => { try { setPreference(value); } catch { Alert.alert(t("Язык не сохранён"), t("Не удалось сохранить язык. Проверьте свободное место.")); } }} />
          <Text style={styles.sectionTitle}>{t("Тема")}</Text>
          <SelectField label={t("Тема")} value={themePreference} options={[{ value: 'system', label: t("Системная") }, { value: 'light', label: t("Светлая") }, { value: 'dark', label: t("Тёмная") }]} onChange={value => { try { setTheme(value); } catch { Alert.alert(t("Настройки не сохранены"), t("Не удалось сохранить тему. Проверьте свободное место.")); } }} />
          <Text style={styles.sectionTitle}>{t("Режим карты")}</Text>
          {mapModes.map((item) => <Pressable key={item.value} accessibilityRole="radio" accessibilityState={{ checked: mode === item.value }} disabled={!!busy} onPress={() => changeMode(item.value)} style={styles.option}><View style={[styles.radio, mode === item.value && styles.radioSelected]}>{mode === item.value && <View style={styles.radioDot}/>}</View><View style={styles.spacer}><Text style={styles.optionTitle}>{t(item.title)}</Text><Text style={styles.descriptionSmall}>{t(item.description)}</Text></View></Pressable>)}
          <View style={styles.offlineCard}>
            <Text style={styles.sectionTitle}>{statusText}</Text>
            {route && <Text style={styles.descriptionSmall}>{route.name}</Text>}
            <View style={styles.progressTrack}><View style={[styles.progress, { width: `${preparation.percentage}%` }]}/></View>
            <Text style={styles.descriptionSmall}>{Math.floor(preparation.percentage)}% · {n(preparation.bytes / 1024 / 1024)}{' '}{t("МБ ресурсов")}</Text>
            <Text style={styles.descriptionSmall}>{preparation.message ? errorText(preparation.message, "Не удалось подготовить карту.") : (preparation.state === 'ready' ? t("Область маршрута сохранена на телефоне.") : route ? t("Область маршрута с запасом около 1 км, масштабы 0–14. Более крупный масштаб использует те же векторные данные.") : t("Добавьте GPX для подготовки области маршрута."))}</Text>
            {mode !== 'online' && route && preparation.state !== 'loading' && preparation.state !== 'ready' && <Pressable accessibilityRole="button" style={styles.retry} disabled={!!busy} onPress={() => { void perform("cache", async () => { setLibrary(store.setMapsCleared(false)); await controller.configure(mode, route); }); }}><Text style={styles.retryText}>{t("Повторить загрузку")}</Text></Pressable>}
            {preparation.state === 'loading' && <Text style={styles.descriptionSmall}>{t("Оставьте приложение открытым до завершения подготовки.")}</Text>}
          </View>
          <Text style={styles.descriptionSmall}>{t("Выбор сохраняется между запусками. Переключение режима не удаляет текущий GPX или скачанные области. При повторном импорте той же области используется готовая карта.")}</Text>
          <Pressable accessibilityRole="button" disabled={!!busy} style={styles.retry} onPress={clearMaps}><Text style={styles.retryText}>{clearing ? t("Удаление карт…") : t("Удалить все скачанные карты и кэш")}</Text></Pressable>
          <Text style={styles.hint}>MarchMap · {appConfig.expo.version}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
const makeStyles = (c: Colors) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.background }, toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, height: 62 }, brand: { padding: 4 }, spacer: { flex: 1 }, iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: c.soft }, add: { backgroundColor: '#155847' }, mapArea: { flex: 1, minHeight: 100 }, location: { position: 'absolute', right: 14, top: 14, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },
    panel: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, gap: 8, backgroundColor: c.background, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, routeRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, routeName: { fontSize: 16, fontWeight: '700', color: c.text }, hint: { fontSize: 11, color: c.muted }, status: { flexDirection: 'row', gap: 6, alignItems: 'center' }, statusDot: { width: 6, height: 6, borderRadius: 3 }, gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 22 }, reset: { color: c.accent, fontSize: 12, fontWeight: '600', paddingVertical: 6 }, legend: { color: c.muted, fontSize: 9, textAlign: 'center' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24, backgroundColor: c.empty }, emptyTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: c.text }, description: { fontSize: 16, lineHeight: 25, color: c.muted, textAlign: 'center' }, modeHint: { color: c.accent, fontSize: 12, marginTop: 30 }, settingsTitle: { fontSize: 22, fontWeight: '700', color: c.text }, settingsContent: { padding: 22, gap: 18 }, sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text }, option: { flexDirection: 'row', gap: 14, paddingVertical: 10 }, radio: { width: 25, height: 25, borderRadius: 13, borderWidth: 1.5, borderColor: c.radio, alignItems: 'center', justifyContent: 'center' }, radioSelected: { borderColor: c.green }, radioDot: { width: 15, height: 15, borderRadius: 8, backgroundColor: c.green }, optionTitle: { fontSize: 16, color: c.text, marginBottom: 5 }, descriptionSmall: { fontSize: 13, color: c.muted, lineHeight: 20 }, offlineCard: { padding: 18, borderRadius: 18, borderWidth: 1, borderColor: c.line, gap: 12 }, progressTrack: { height: 6, backgroundColor: c.track, borderRadius: 3, overflow: 'hidden' }, progress: { height: 6, backgroundColor: c.progress }, retry: { padding: 13, borderWidth: 1, borderColor: c.border, borderRadius: 12, alignItems: 'center' }, retryText: { color: c.accent, fontWeight: '600' },
});
