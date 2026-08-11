import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Card, SectionTitle } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useDocsForRef, useStore } from '@/store/useStore';
import { docPreview } from '@/utils/blocks';

/**
 * The notes you've written about a verse.
 *
 * There used to be two separate silos here — private per-verse notes and notes
 * shared to the circle. Both are gone: a note is just a note, linked to this
 * reference, visible to your partner unless you mark it private.
 */
export function VerseDocs({ reference }: { reference: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const docs = useDocsForRef(reference);
  const createDoc = useStore((s) => s.createDoc);

  const write = () => {
    const id = createDoc('note', { anchorRef: reference, title: reference });
    router.push(`/notes/${id}`);
  };

  return (
    <View>
      <SectionTitle>Your notes on this</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {docs.map((d) => (
          <Card key={d.id} onPress={() => router.push(`/notes/${d.id}`)} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md, flex: 1 }} numberOfLines={1}>
                {d.title || 'Untitled note'}
              </Text>
              {d.private ? <Ionicons name="lock-closed" size={13} color={colors.textFaint} /> : null}
            </View>
            <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 20 }}>
              {docPreview(d)}
            </Text>
          </Card>
        ))}

        <Pressable
          onPress={write}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            paddingVertical: spacing.md,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
          })}
        >
          <Ionicons name="create-outline" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.sm }}>
            {docs.length ? 'Write another note' : 'Write a note on this verse'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
