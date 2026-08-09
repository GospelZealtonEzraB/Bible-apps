import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { Screen, Header } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { bookByNumber, chapterCount } from '@/data/structure';

export default function ChapterGridScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ book: string }>();
  const bookNumber = Number(params.book);
  const book = bookByNumber(bookNumber);
  const count = chapterCount(bookNumber);

  if (!book || count === 0) {
    return (
      <Screen>
        <Header title="Read" back />
        <EmptyState emoji="📖" title="Book not found" subtitle="Head back and pick a book from the list." />
      </Screen>
    );
  }

  const chapters = Array.from({ length: count }, (_, i) => i + 1);

  return (
    <Screen>
      <Header title={book.name} subtitle={`${count} chapter${count === 1 ? '' : 's'}`} back />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {chapters.map((c) => (
          <Pressable
            key={c}
            onPress={() => router.push(`/read/${bookNumber}/${c}`)}
            style={({ pressed }) => ({
              width: 52,
              height: 52,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? colors.primarySoft : colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
            })}
          >
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{c}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
