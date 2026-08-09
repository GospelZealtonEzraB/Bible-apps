import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
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
      <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.lg }} onPress={onClose}>
        <Pressable
          onPress={() => {}}
          style={{ backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.border }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.md }}>{reference}</Text>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>KJV</Text>
          </View>

          {loading ? <ActivityIndicator color={colors.primary} /> : null}
          {error ? <Text style={{ color: colors.warning, fontSize: font.sizes.sm }}>{error}</Text> : null}
          {text ? (
            <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 26, fontFamily: font.serif }}>{text}</Text>
          ) : null}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.lg, marginTop: spacing.xs }}>
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
