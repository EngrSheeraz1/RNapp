import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/constants/theme';

type ScreenProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export function Screen({ eyebrow, title, description, children }: ScreenProps) {
  const { colors } = useTheme();

  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text style={[styles.eyebrow, { color: colors.accent }]}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[styles.description, { color: colors.secondary }]}>{description}</Text>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ title, children }: PropsWithChildren<{ title: string }>) {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text accessibilityRole="header" style={[styles.cardTitle, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.description, { color: colors.secondary }]}>{children}</Text>
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
    padding: 24,
    paddingTop: 40,
    paddingBottom: 32,
    gap: 20,
  },
  heading: { gap: 12, marginBottom: 8 },
  eyebrow: { fontSize: 13, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' },
  title: { fontSize: 36, fontWeight: '800' },
  description: { fontSize: 16, lineHeight: 25 },
  card: { borderWidth: 1, borderRadius: 20, padding: 24, gap: 10 },
  cardTitle: { fontSize: 20, fontWeight: '700' },
  button: { borderRadius: 14, paddingHorizontal: 24, paddingVertical: 17, alignItems: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
