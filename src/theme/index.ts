import { useColorScheme } from 'react-native';
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
  primary: '#7C9CF5',
  primarySoft: '#25314F',
  onPrimary: '#0B1220',
  accent: '#F5C97C',
  success: '#5FD0A0',
  warning: '#F5C97C',
  danger: '#F58C8C',
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
  primary: '#3F63C8',
  primarySoft: '#E4EAFB',
  onPrimary: '#FFFFFF',
  accent: '#C98A2B',
  success: '#2FA277',
  warning: '#C98A2B',
  danger: '#C84D4D',
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
