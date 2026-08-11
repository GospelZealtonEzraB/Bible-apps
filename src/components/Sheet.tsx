import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';

import { useTheme, spacing, font, radius } from '@/theme';

/**
 * The one bottom-sheet.
 *
 * Every modal in the app goes through here so long content behaves: the sheet
 * is capped at a share of the screen and scrolls inside itself, instead of
 * growing taller than the window and pushing its own buttons out of view. The
 * keyboard is accounted for too, so a composer inside a sheet stays visible.
 *
 * Tap the backdrop or the grabber to dismiss; content never swallows the tap.
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  /** Fraction of the screen height the sheet may occupy. */
  maxHeightRatio = 0.85,
  /** Set false when the child manages its own scrolling (e.g. a FlatList). */
  scrollable = true,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightRatio?: number;
  scrollable?: boolean;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const maxHeight = Math.round(height * maxHeightRatio);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        {/* Backdrop — tapping anywhere outside the sheet closes it. */}
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />

        <View
          style={{
            maxHeight,
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: spacing.lg,
          }}
        >
          {/* Grabber — the affordance every sheet on a phone has. */}
          <Pressable onPress={onClose} hitSlop={12} style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: spacing.xs }}>
            <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          </Pressable>

          {title ? (
            <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>{title}</Text>
              {subtitle ? (
                <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginTop: 2 }}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}

          {scrollable ? (
            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1, paddingHorizontal: spacing.lg }}>{children}</View>
          )}

          {footer ? <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
