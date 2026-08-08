import React from 'react';
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '@/theme';
import { radius, spacing, font } from '@/theme';
import type { VerseStatus } from '@/types';

// ---- Card -----------------------------------------------------------------
export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, style, pressed && { opacity: 0.85 }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

// ---- Button ---------------------------------------------------------------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  style,
  small,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  small?: boolean;
}) {
  const { colors } = useTheme();
  const bg: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.surfaceAlt,
    ghost: 'transparent',
    danger: colors.danger,
  };
  const fg: Record<ButtonVariant, string> = {
    primary: colors.onPrimary,
    secondary: colors.text,
    ghost: colors.primary,
    danger: '#fff',
  };
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg[variant],
          borderRadius: radius.pill,
          paddingVertical: small ? spacing.sm : spacing.md + 2,
          paddingHorizontal: spacing.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          opacity: isDisabled ? 0.5 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <>
          {icon}
          <Text
            style={{
              color: fg[variant],
              fontWeight: '700',
              fontSize: small ? font.sizes.sm : font.sizes.md,
            }}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

// ---- Chip -----------------------------------------------------------------
export function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingVertical: spacing.xs + 2,
        paddingHorizontal: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: active ? colors.primary : colors.surfaceAlt,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? colors.primary : colors.border,
      }}
    >
      <Text
        style={{
          color: active ? colors.onPrimary : colors.textMuted,
          fontWeight: '600',
          fontSize: font.sizes.sm,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---- StatusBadge ----------------------------------------------------------
const STATUS_META: Record<VerseStatus, { label: string; key: keyof ReturnType<typeof useTheme>['colors'] }> = {
  new: { label: 'New', key: 'textFaint' },
  learning: { label: 'Learning', key: 'accent' },
  reviewing: { label: 'Reviewing', key: 'primary' },
  memorized: { label: 'Memorized', key: 'success' },
};

export function StatusBadge({ status }: { status: VerseStatus }) {
  const { colors } = useTheme();
  const meta = STATUS_META[status];
  const color = colors[meta.key];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        alignSelf: 'flex-start',
        paddingVertical: 3,
        paddingHorizontal: spacing.sm,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <View
        style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }}
      />
      <Text style={{ color, fontSize: font.sizes.xs, fontWeight: '700' }}>
        {meta.label}
      </Text>
    </View>
  );
}

// ---- Text helpers ---------------------------------------------------------
export function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Text
      style={[
        {
          color: colors.textMuted,
          fontSize: font.sizes.sm,
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function EmptyState({
  emoji,
  title,
  subtitle,
  action,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.sm }}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text
        style={{
          color: colors.text,
          fontSize: font.sizes.lg,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text
          style={{
            color: colors.textMuted,
            fontSize: font.sizes.md,
            textAlign: 'center',
            maxWidth: 300,
            lineHeight: 22,
          }}
        >
          {subtitle}
        </Text>
      ) : null}
      {action ? <View style={{ marginTop: spacing.md }}>{action}</View> : null}
    </View>
  );
}
