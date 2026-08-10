import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Card, SectionTitle } from '@/components/ui';
import { RichText } from '@/components/RichText';
import { useShareToCircle } from '@/components/useShareToCircle';
import { useTheme, spacing, font, radius } from '@/theme';
import { useDocsForRef, useStore } from '@/store/useStore';
import { docPreview, docPlainText } from '@/utils/blocks';

/**
 * "My notes" on a verse — now backed by the unified Doc model. Any document that
 * links this reference (a verse note, a study note) shows here and opens in the
 * full block editor. Writing a note creates a `verse` Doc anchored to the ref.
 */
export function VerseNotes({ reference }: { reference: string }) {
  const { colors } = useTheme();
  const router = useRouter();
  const docs = useDocsForRef(reference).filter((d) => d.type === 'verse' || d.type === 'note' || d.type === 'study');
  const createDoc = useStore((s) => s.createDoc);
  const { canShare, share } = useShareToCircle();

  const newNote = () => {
    const id = createDoc('verse', { anchorRef: reference, title: reference });
    router.push(`/notes/${id}`);
  };

  return (
    <View>
      <SectionTitle>My notes</SectionTitle>
      <View style={{ gap: spacing.sm }}>
        {docs.map((d) => (
          <Card key={d.id} onPress={() => router.push(`/notes/${d.id}`)} style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 }}>
                <Ionicons name={d.shared ? 'people' : 'lock-closed'} size={11} color={d.shared ? colors.primary : colors.textFaint} />
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>{d.shared ? 'Shared' : 'Private'}</Text>
              </View>
              {canShare ? (
                <Pressable onPress={() => share(docPlainText(d), reference)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
                  <Ionicons name="people-outline" size={16} color={colors.textFaint} />
                </Pressable>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
            </View>
            {d.title && d.title !== reference ? (
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.sm }}>{d.title}</Text>
            ) : null}
            <RichText text={docPreview(d) || 'Open note'} style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22 }} />
          </Card>
        ))}

        <Pressable onPress={newNote} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.sm }}>Write a note on this verse</Text>
        </Pressable>
      </View>
    </View>
  );
}
