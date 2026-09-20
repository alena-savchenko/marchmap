import { useTheme } from '../theme/theme';
import type { Colors } from '../theme/core';
import { useLanguage } from '../i18n/language';
import { StyleSheet, Text, View } from 'react-native';
import type { RoutePosition } from '../models/route';
export function RouteStats({ title, position, color }: {
    title: string;
    position: RoutePosition;
    color: string;
}) {
    const { t, n } = useLanguage();
    const { colors: c } = useTheme();
    const styles = makeStyles(c);
    return <View style={styles.card}>
    <Text style={[styles.title, { color }]}>{title}</Text>
    <View style={styles.row}>
      {[[t("{v0} км", { v0: n(position.distance) }), t("от старта")], [t("{v0} км", { v0: n(position.remainingDistance) }), t("до финиша")], [position.elevation === null ? '—' : t("{v0} м", { v0: Math.round(position.elevation) }), t("высота")]].map(([value, label]) => <View key={label} style={styles.stat}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>)}
    </View>
  </View>;
}
const makeStyles = (c: Colors) => StyleSheet.create({ card: { gap: 6 }, title: { fontSize: 11, fontWeight: '600' }, row: { flexDirection: 'row' }, stat: { flex: 1 }, value: { fontSize: 21, fontWeight: '700', color: c.text }, label: { fontSize: 12, color: c.muted } });
