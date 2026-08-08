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

/** Darken (pct<0) or lighten (pct>0) a hex color — used for the 3D button lip. */
export function shade(hex: string, pct: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  const f = 1 + pct;
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) * f);
  const g = clamp(((n >> 8) & 255) * f);
  const b = clamp((n & 255) * f);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

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
  const { colors, dark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    // Soft elevation for a friendly, tactile feel.
    shadowColor: '#000',
    shadowOpacity: dark ? 0.28 : 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  };
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, style, pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }]}
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
  // The darker "lip" beneath the button — the Duolingo-style press depth.
  const edge: Record<ButtonVariant, string> = {
    primary: shade(colors.primary, -0.26),
    secondary: colors.border,
    ghost: 'transparent',
    danger: shade(colors.danger, -0.26),
  };
  const isDisabled = disabled || loading;
  const flat = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg[variant],
          borderRadius: 16,
          paddingVertical: small ? 9 : 15,
          paddingHorizontal: spacing.xl,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          borderWidth: flat ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
          borderBottomWidth: flat ? StyleSheet.hairlineWidth : pressed ? 2 : 4,
          borderBottomColor: flat ? colors.border : edge[variant],
          transform: [{ translateY: !flat && pressed ? 2 : 0 }],
          opacity: isDisabled ? 0.55 : 1,
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
              fontWeight: '800',
              fontSize: small ? font.sizes.sm : font.sizes.md,
              letterSpacing: 0.2,
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

/** A rounded speech bubble for Ember's coach voice, with a little tail. */
export function SpeechBubble({ children, tail = 'left' }: { children: React.ReactNode; tail?: 'left' | 'none' }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.lg,
          borderTopLeftRadius: tail === 'left' ? 4 : radius.lg,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.md,
        }}
      >
        {typeof children === 'string' ? (
          <Text style={{ color: colors.text, fontSize: font.sizes.sm, fontFamily: font.serif, fontStyle: 'italic', lineHeight: 20 }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </View>
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
