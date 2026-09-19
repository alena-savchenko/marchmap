import Svg, { Circle, Path } from 'react-native-svg';
import { Image } from 'react-native';
export function Icon({ name, size = 24, color = '#155847' }: { name: 'mountain' | 'plus' | 'location' | 'settings' | 'close' | 'folder' | 'trash'; size?: number; color?: string }) {
  if (name === 'mountain') return <Image source={require('../../assets/brand-symbol.png')} style={{ width: size, height: size }} resizeMode="contain" />;
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    {name === 'folder' && <Path d="M3 6h6l2 3h10v11H3ZM3 6V4h7l2 3h8v2" />}
    {name === 'trash' && <Path d="M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7" />}
    {name === 'plus' && <Path d="M12 5v14M5 12h14" />}
    {name === 'location' && <><Circle cx={12} cy={12} r={7} /><Circle cx={12} cy={12} r={2} fill={color} /><Path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>}
    {name === 'settings' && <><Path d="m9 3-1 3-3 1-2 4 2 2v3l4 3 3-1 3 1 4-3v-3l2-2-2-4-3-1-1-3Z" /><Circle cx={12} cy={11} r={3} /></>}
    {name === 'close' && <Path d="m6 6 12 12M6 18 18 6" />}
  </Svg>;
}
