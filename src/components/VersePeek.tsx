import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, font, radius } from '@/theme';
import { getVerse, isLatinTranslation } from '@/data/bibleApi';

/**
 * A lightweight popover that shows the text of a reference without leaving the
 * screen — so a reader instantly understands an inline reference. Resolves
 * local-first (KJV is offline/instant); reusable wherever references appear.
 */
export function VersePeek({ reference, onClose }: { reference: string | null; onClose: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!reference) return;
    let active = true;
    setText(null);
    setError(null);
    setLoading(true);
    getVerse(reference, 'kjv')
      .then((v) => active && setText(v.text))
      .catch((e) => active && setError(e instanceof Error ? e.message : 'Could not load that verse.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reference]);

  return (
    <Modal visible={!!reference} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg }}
        onPress={onClose}
      >
        <Pressable
          onPress={() => {}}
          // A whole chapter can land here, so cap the height and let it scroll
          // rather than growing past the screen.
          style={{
            maxHeight: '75%',
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.md }}>{reference}</Text>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>KJV</Text>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }}>
            {loading ? <ActivityIndicator color={colors.primary} /> : null}
            {error ? <Text style={{ color: colors.warning, fontSize: font.sizes.sm }}>{error}</Text> : null}
            {text ? (
              <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 26, fontFamily: font.serif }}>{text}</Text>
            ) : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg, padding: spacing.lg, paddingTop: spacing.sm }}>
            {reference ? (
              <Pressable onPress={() => { const r = reference; onClose(); router.push(`/study/${encodeURIComponent(r)}`); }}>
                <Text style={{ color: colors.textMuted, fontWeight: '700', fontSize: font.sizes.sm }}>Study</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose}>
              <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.sm }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
