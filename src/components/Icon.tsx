import Svg, { Circle, Path } from 'react-native-svg';
export function Icon({ name, size = 24, color = '#155847' }: { name: 'mountain' | 'plus' | 'location' | 'settings' | 'close'; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {name === 'mountain' && <><Path d="M2 20 10 5l8 15Z" fill={color} /><Path d="m13 11 3-6 7 15h-3" stroke="#a8bb83" /><Path d="m7 11 3 3 2-3" stroke="white" /></>}
    {name === 'plus' && <Path d="M12 5v14M5 12h14" />}
    {name === 'location' && <><Circle cx={12} cy={12} r={7} /><Circle cx={12} cy={12} r={2} fill={color} /><Path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>}
    {name === 'settings' && <><Path d="m9 3-1 3-3 1-2 4 2 2v3l4 3 3-1 3 1 4-3v-3l2-2-2-4-3-1-1-3Z" /><Circle cx={12} cy={11} r={3} /></>}
    {name === 'close' && <Path d="m6 6 12 12M6 18 18 6" />}
  </Svg>;
}
