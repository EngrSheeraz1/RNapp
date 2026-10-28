import Ionicons from '@expo/vector-icons/Ionicons';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Tabs, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/theme';

export default function RootLayout() {
  const { colors, isDark } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 12);

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Tabs
        backBehavior="history"
        screenOptions={{
          headerShown: false,
          tabBarPosition: 'bottom',
          tabBarShowLabel: true,
          tabBarLabelPosition: 'below-icon',
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.secondary,
          tabBarActiveBackgroundColor: colors.selectedTab,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 64 + bottomPadding,
            paddingTop: 8,
            paddingBottom: bottomPadding,
          },
          tabBarItemStyle: { borderRadius: 14, marginHorizontal: 12, paddingVertical: 4 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
          sceneStyle: { backgroundColor: colors.background },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarHideOnKeyboard: true,
            tabBarAccessibilityLabel: 'Home tab',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="about"
          options={{
            title: 'About',
            tabBarAccessibilityLabel: 'About tab',
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons
                name={focused ? 'information-circle' : 'information-circle-outline'}
                size={size}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="sign-up"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />
        <Tabs.Screen
          name="forgot-password"
          options={{ href: null, tabBarStyle: { display: 'none' } }}
        />
      </Tabs>
      <StatusBar style={pathname === '/about' && isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
