import { useLanguage } from '../i18n/language';
import { Modal, Pressable, FlatList, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Library, SavedRoute } from '../services/routeLibrary';
import { Icon } from './Icon';
export function RouteLibraryModal({ visible, library, disabled, onClose, onOpen, onDelete }: {
    visible: boolean;
    library: Library;
    disabled: boolean;
    onClose: () => void;
    onOpen: (route: SavedRoute) => void;
    onDelete: (route: SavedRoute) => void;
}) {
    const { t, n, language } = useLanguage();
    return <Modal visible={visible} animationType="slide" onRequestClose={onClose}><SafeAreaView style={styles.safe}>
    <View style={styles.header}><Text style={styles.title}>{t("Мои маршруты")}</Text><Pressable accessibilityRole="button" accessibilityLabel={t("Закрыть маршруты")} style={styles.button} onPress={onClose}><Icon name="close"/></Pressable></View>
    <FlatList data={library.routes} keyExtractor={(item) => item.id} contentContainerStyle={styles.list} ListEmptyComponent={<Text style={styles.hint}>{t("Пока нет маршрутов. Добавьте GPX кнопкой + или откройте его из файлового менеджера.")}</Text>} renderItem={({ item }) => <View style={[styles.card, item.id === library.activeId && styles.active]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t("Открыть маршрут {v0}", { v0: item.name })} accessibilityState={{ selected: item.id === library.activeId, disabled }} disabled={disabled} onPress={() => onOpen(item)} style={styles.route}>
        <Text style={styles.name}>{item.name}</Text><Text style={styles.hint}>{n(item.distance)}{' '}{t("км ·")}{' '}{item.pointCount}{' '}{t("точек")}</Text><Text style={styles.hint}>{item.id === library.activeId ? t("Открыт сейчас") : new Date(item.importedAt).toLocaleDateString(language)}</Text>
      </Pressable><Pressable accessibilityRole="button" accessibilityLabel={t("Удалить маршрут {v0}", { v0: item.name })} disabled={disabled} onPress={() => onDelete(item)} style={styles.button}><Icon name="trash" color="#a34832"/></Pressable>
    </View>}/>
  </SafeAreaView></Modal>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#fbfcfa' }, header: { paddingHorizontal: 20, height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 22, fontWeight: '700', color: '#173f36' }, button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, list: { padding: 20, gap: 12 }, card: { borderRadius: 16, borderWidth: 1, borderColor: '#dce6de', padding: 12, flexDirection: 'row', alignItems: 'center' }, active: { backgroundColor: '#e9f3ed', borderColor: '#69a58b' }, route: { flex: 1, gap: 5, padding: 4 }, name: { fontSize: 16, fontWeight: '600', color: '#173f36' }, hint: { color: '#637770', fontSize: 13, lineHeight: 20 } });
