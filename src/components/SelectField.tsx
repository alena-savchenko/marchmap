import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '../theme/theme';
import { Icon } from './Icon';
/** In-place dropdown: scrolls independently when the language catalog grows. */
export function SelectField<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: readonly { value: T; label: string }[]; onChange: (value: T) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { colors: c } = useTheme();
  return <View style={{ gap: 6 }}>
    <Pressable accessibilityRole="combobox" accessibilityLabel={label} accessibilityValue={{ text: options.find(option => option.value === value)?.label }} accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={{ minHeight: 48, padding: 13, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <Text style={{ flex: 1, color: c.text, fontSize: 16 }}>{options.find(option => option.value === value)?.label}</Text>
      <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}><Icon name="chevron" /></View>
    </Pressable>
    {expanded && <ScrollView nestedScrollEnabled style={{ maxHeight: 240, borderWidth: 1, borderColor: c.border, borderRadius: 12, backgroundColor: c.surface }}>
      {options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => { onChange(option.value); setExpanded(false); }} style={{ minHeight: 48, padding: 13, backgroundColor: value === option.value ? c.selected : c.surface }}><Text style={{ color: c.text, fontSize: 16 }}>{option.label}{value === option.value ? '  ✓' : ''}</Text></Pressable>)}
    </ScrollView>}
  </View>;
}
