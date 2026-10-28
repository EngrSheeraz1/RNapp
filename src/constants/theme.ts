import { useColorScheme } from 'react-native';

const colors = {
  light: {
    background: '#F5F7FB',
    surface: '#FFFFFF',
    text: '#17243B',
    secondary: '#526078',
    accent: '#365BDC',
    selectedTab: '#EAF0FF',
    border: '#E0E6EF',
  },
  dark: {
    background: '#101827',
    surface: '#1B263B',
    text: '#F2F5FC',
    secondary: '#B0BDD3',
    accent: '#A2B6FF',
    selectedTab: '#293B62',
    border: '#33415B',
  },
};

export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return { colors: colors[isDark ? 'dark' : 'light'], isDark };
}
