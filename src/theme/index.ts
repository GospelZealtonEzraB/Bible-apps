import { Platform, useColorScheme } from 'react-native';
import { useSettings } from '@/store/useStore';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  overlay: string;
}

const dark: Palette = {
  bg: '#0B1220',
  surface: '#141C2E',
  surfaceAlt: '#1C2740',
  border: '#2A3654',
  text: '#EEF2FB',
  textMuted: '#A9B4CC',
  textFaint: '#6B7896',
  primary: '#8AA6FF',
  primarySoft: '#26325A',
  onPrimary: '#0B1220',
  accent: '#FFC24B',
  success: '#57D9A3',
  warning: '#FFC24B',
  danger: '#FF8A8A',
  overlay: 'rgba(0,0,0,0.55)',
};

const light: Palette = {
  bg: '#F6F8FD',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2FB',
  border: '#DDE4F1',
  text: '#141C2E',
  textMuted: '#4C5875',
  textFaint: '#8A96B0',
  primary: '#3E63E0',
  primarySoft: '#E6ECFF',
  onPrimary: '#FFFFFF',
  accent: '#E8901A',
  success: '#1FA97A',
  warning: '#E8901A',
  danger: '#D64B4B',
  overlay: 'rgba(15,22,40,0.45)',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 26,
  pill: 999,
};

export const font = {
  sizes: { xs: 12, sm: 14, md: 16, lg: 20, xl: 26, xxl: 34, display: 44 },
  serif:
    'Georgia, "Iowan Old Style", "Palatino Linotype", "Times New Roman", serif',
  /** Fixed-width — for chord sheets, where column alignment carries meaning. */
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) as string,
};

export interface Theme {
  colors: Palette;
  dark: boolean;
}

/** Resolve the active theme, honoring the user's system/light/dark preference. */
export function useTheme(): Theme {
  const system = useColorScheme();
  const pref = useSettings((s) => s.theme);
  const resolved = pref === 'system' ? system ?? 'dark' : pref;
  const isDark = resolved === 'dark';
  return { colors: isDark ? dark : light, dark: isDark };
}

export { dark as darkPalette, light as lightPalette };
