import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, TextInput, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Header } from '@/components/layout';
import { Card } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { HYMNS, type Hymn } from '@/data/hymns';
import { searchSongbook } from '@/data/songSearch';
import { useStore } from '@/store/useStore';
import { EmberTip } from '@/components/EmberGuide';

export default function HymnsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const serverUrl = useStore((s) => s.settings.serverUrl);
  const [query, setQuery] = useState('');
  const [lang, setLang] = useState<'all' | 'en' | 'ta'>('all');
  const [base, setBase] = useState<Hymn[]>(HYMNS);
  const [semantic, setSemantic] = useState(false);
  const hasTamil = useMemo(() => HYMNS.some((h) => h.language === 'ta'), []);

  // Meaning-based search (online, Tamil+English) with an offline keyword fallback.
  // Debounced so we don't fire a request on every keystroke.
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      searchSongbook(query, { serverUrl }).then((r) => {
        if (!active) return;
        setBase(r.results);
        setSemantic(r.source === 'semantic');
      });
    }, query.trim().length >= 2 ? 300 : 0);
    return () => { active = false; clearTimeout(t); };
  }, [query, serverUrl]);

  const results = useMemo(
    () => (lang === 'all' ? base : base.filter((h) => (h.language ?? 'en') === lang)),
    [base, lang],
  );

  const renderItem = ({ item: h }: { item: Hymn }) => (
    <Pressable
      onPress={() => router.push(`/hymns/${h.id}`)}
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="musical-notes-outline" size={20} color={colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md, fontFamily: h.language === 'ta' ? undefined : undefined }} numberOfLines={1}>{h.title}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }} numberOfLines={1}>{h.author ?? 'Traditional'}{h.language === 'ta' ? ' · தமிழ்' : ''}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Header
          title="Hymns"
          subtitle={`${HYMNS.length} public-domain hymns`}
          back
          right={
            <Pressable onPress={() => router.push('/songs')} hitSlop={12} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}>
              <Ionicons name="search" size={14} color={colors.primary} />
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>Songs</Text>
            </Pressable>
          }
        />
        <EmberTip topic="hymns" />
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
        {hasTamil ? (
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {([['all', 'All'], ['en', 'English'], ['ta', 'தமிழ்']] as const).map(([k, label]) => (
              <Pressable key={k} onPress={() => setLang(k)} style={{ paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: lang === k ? colors.primary : colors.surfaceAlt }}>
                <Text style={{ color: lang === k ? colors.onPrimary : colors.textMuted, fontWeight: '700', fontSize: font.sizes.sm }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
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
