import { StyleSheet, Text, View } from 'react-native';
import type { RoutePosition } from '../models/route';
export function RouteStats({ title, position, color }: { title: string; position: RoutePosition; color: string }) {
  return <View style={styles.card}>
    <Text style={[styles.title, { color }]}>{title}</Text>
    <View style={styles.row}>
      {[[`${position.distance.toFixed(1)} км`, 'от старта'], [`${position.remainingDistance.toFixed(1)} км`, 'до финиша'], [position.elevation === null ? '—' : `${Math.round(position.elevation)} м`, 'высота']].map(([value, label]) => <View key={label} style={styles.stat}><Text style={styles.value}>{value}</Text><Text style={styles.label}>{label}</Text></View>)}
    </View>
  </View>;
}
const styles = StyleSheet.create({ card: { gap: 6 }, title: { fontSize: 11, fontWeight: '600' }, row: { flexDirection: 'row' }, stat: { flex: 1 }, value: { fontSize: 21, fontWeight: '700', color: '#172f2a' }, label: { fontSize: 12, color: '#637770' } });
