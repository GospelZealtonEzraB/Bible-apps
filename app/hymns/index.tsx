import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Header } from '@/components/layout';
import { Card } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { HYMNS, searchHymns, type Hymn } from '@/data/hymns';

export default function HymnsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchHymns(query), [query]);

  const renderItem = ({ item: h }: { item: Hymn }) => (
    <Pressable
      onPress={() => router.push(`/hymns/${h.id}`)}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="musical-notes-outline" size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }} numberOfLines={1}>{h.title}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }} numberOfLines={1}>{h.author ?? 'Traditional'}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Header title="Hymns" subtitle={`${HYMNS.length} public-domain hymns`} back />
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm }}>
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search — title, author, or a line"
            placeholderTextColor={colors.textFaint}
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.md }}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.textFaint} />
            </Pressable>
          ) : null}
        </Card>
      </View>
      <FlatList
        data={results}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={12}
        ListEmptyComponent={<Text style={{ color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl }}>No hymns found — try a different word.</Text>}
      />
    </SafeAreaView>
  );
}
