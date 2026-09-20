import { Text, View } from 'react-native';
import type { ClimbStatus } from '../services/climbs';
import { useLanguage } from '../i18n/language';
import { useTheme } from '../theme/theme';
export function ClimbCard({ status }: { status: ClimbStatus | null }) {
  const { t, n } = useLanguage();
  const { colors: c } = useTheme();
  if (!status) return null;
  return <View style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, backgroundColor: c.selected, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
    <Text style={{ color: c.text, fontSize: 12 }}>{t('До вершины')}</Text>
    <Text style={{ color: c.accent, fontWeight: '700', fontSize: 14 }}>{t('{distance} км → · +{gain} м ↑', { distance: n(status.remainingDistance), gain: n(status.remainingGain, 0) })}</Text>
  </View>;
}
