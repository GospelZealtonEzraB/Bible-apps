import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, font } from '@/theme';

/** Full-screen container honoring the safe area and theme background. */
export function Screen({
  children,
  scroll = true,
  contentStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const padded = [
    { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
    contentStyle,
  ];
  return (
    <SafeAreaView
      edges={['top']}
      style={{ flex: 1, backgroundColor: colors.bg }}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={padded}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padded]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.headerRow}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        {back ? (
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  title: { fontSize: font.sizes.xxl, fontWeight: '800' },
  subtitle: { fontSize: font.sizes.md, marginTop: 2 },
});
