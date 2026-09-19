import { StyleSheet, Text, View } from 'react-native';
import type { RoutePosition } from '../models/route';
export function RouteStats({ title, position, color }: { title: string; position: RoutePosition; color: string }) {
  return <View style={[styles.card, { borderLeftColor: color }]}>
    <Text style={styles.title}>{title}</Text>
    <Text>{position.distance.toFixed(1)} км от старта · {position.remainingDistance.toFixed(1)} км до финиша</Text>
    <Text>Высота: {position.elevation === null ? 'нет данных' : `${Math.round(position.elevation)} м`}</Text>
  </View>;
}
const styles = StyleSheet.create({ card: { gap: 4, borderLeftWidth: 4, padding: 10, backgroundColor: '#f0f4f5', borderRadius: 6 }, title: { fontWeight: '700', color: '#20343e' } });
