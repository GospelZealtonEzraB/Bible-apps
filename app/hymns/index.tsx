import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, EmptyState } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { HYMNS, searchHymns } from '@/data/hymns';

export default function HymnsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchHymns(query), [query]);

  return (
    <Screen>
      <Header title="Hymns" subtitle={`${HYMNS.length} public-domain hymns · lyrics & chords`} back />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search hymns — title, author, or a line"
          placeholderTextColor={colors.textFaint}
          style={{ flex: 1, color: colors.text, fontSize: font.sizes.md }}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </Card>

      {results.length === 0 ? (
        <EmptyState emoji="🎵" title="No hymns found" subtitle="Try a different word — a title, author, or a line of the hymn." />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {results.map((h) => (
            <Pressable
              key={h.id}
              onPress={() => router.push(`/hymns/${h.id}`)}
              style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md })}
            >
              <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="musical-notes-outline" size={20} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{h.title}</Text>
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{h.author}{h.year ? ` · ${h.year}` : ''}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}
