import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import type { ClimbSettings } from '../config/climbs';
import { getClimbPreview } from '../services/climbs';
import { isValidClimbSettings } from '../services/climbSettings';
import { useLanguage } from '../i18n/language';
import { useTheme } from '../theme/theme';
import { SelectField } from './SelectField';
export function ClimbSettingsSection({ settings, onChange }: { settings: ClimbSettings; onChange: (next: ClimbSettings) => void }) {
  const { t, n } = useLanguage();
  const { colors: c } = useTheme();
  const [grade, setGrade] = useState(String(settings.customGrade));
  const [length, setLength] = useState(String(settings.customDistanceM));
  const numeric = (text: string) => /^\d+(?:[.,]\d+)?$/.test(text.trim()) ? Number(text.trim().replace(',', '.')) : NaN;
  const custom: ClimbSettings = { preset: 'custom', customGrade: numeric(grade), customDistanceM: numeric(length) };
  const valid = isValidClimbSettings(custom);
  const label = { color: c.text, fontSize: 14 };
  const hint = { color: c.muted, fontSize: 12, lineHeight: 18 };
  const input = { color: c.text, backgroundColor: c.surface, borderColor: c.border, borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 44 };
  return <View style={{ gap: 12 }}>
    <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>{t('Подъёмы')}</Text>
    <Text style={hint}>{t('Показывать «до вершины», когда подъём достаточно значим для меня')}</Text>
    <SelectField label={t('Чувствительность подъёмов')} value={settings.preset} options={[
      { value: 'high', label: t('Высокая чувствительность') }, { value: 'medium', label: t('Средняя') },
      { value: 'low', label: t('Низкая') }, { value: 'custom', label: t('Своя') },
    ]} onChange={preset => onChange({ ...settings, preset })} />
    <Text style={hint}>{settings.preset === 'high' ? t('Подходит новичкам — показывать более короткие и пологие подъёмы') : settings.preset === 'medium' ? t('Рекомендовано — только заметные подъёмы') : settings.preset === 'low' ? t('Для опытных — показывать только серьёзные подъёмы') : t('Более крутой подъём может быть короче, а более пологий — длиннее. Это ориентир тяжести, а не два обязательных условия.')}</Text>
    {settings.preset === 'custom' && <>
      <Text style={label}>{t('Базовый уклон, %')}</Text>
      <TextInput accessibilityLabel={t('Базовый уклон, %')} keyboardType="decimal-pad" value={grade} onChangeText={setGrade} style={input} placeholderTextColor={c.muted} maxLength={7} />
      <Text style={label}>{t('Базовая длина, м')}</Text>
      <TextInput accessibilityLabel={t('Базовая длина, м')} keyboardType="number-pad" value={length} onChangeText={setLength} style={input} placeholderTextColor={c.muted} maxLength={7} />
      {!valid && <Text accessibilityRole="alert" style={{ ...hint, color: c.danger }}>{t('Введите уклон от 1 до 30% и длину от 250 до 50 000 м.')}</Text>}
      {valid && <><Text style={hint}>{t('При этих настройках значимыми будут примерно:')}</Text>{getClimbPreview(custom).map(example => <Text key={example.grade} style={hint}>{example.distanceM >= 1000 ? t('{grade}% × {distance} км', { grade: n(example.grade, 0), distance: n(example.distanceM / 1000, 2) }) : t('{grade}% × {distance} м', { grade: n(example.grade, 0), distance: n(example.distanceM, 0) })}</Text>)}</>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !valid }} disabled={!valid} onPress={() => onChange(custom)} style={{ ...input, opacity: valid ? 1 : .5, alignItems: 'center' }}><Text style={{ color: c.accent, fontWeight: '600' }}>{t('Применить')}</Text></Pressable>
    </>}
  </View>;
}
