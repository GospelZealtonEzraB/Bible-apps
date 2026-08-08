import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useSettings } from '@/store/useStore';
import { getVerse, verseId, isLatinTranslation, type FetchedVerse } from '@/data/bibleApi';
import { suggestPack } from '@/data/aiClient';
import { STARTER_PACKS, type StarterPack } from '@/data/packs';

export default function AddScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const translation = useSettings((s) => s.translation);
  const serverUrl = useSettings((s) => s.serverUrl);
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);
  const hasVerse = useStore((s) => s.hasVerse);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FetchedVerse | null>(null);

  const onLookup = async () => {
    const ref = query.trim();
    if (!ref) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const result = await getVerse(ref, translation, { serverUrl });
      setPreview(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const onSave = () => {
    if (!preview) return;
    const verse = addFetchedVerse(preview);
    setPreview(null);
    setQuery('');
    router.push(`/verse/${encodeURIComponent(verse.id)}`);
  };

  return (
    <Screen>
      <Header title="Add a verse" subtitle="Look one up, or start with a pack" />

      {/* AI Bible study entry */}
      <Card onPress={() => router.push('/study')}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="reader-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>Study a passage</Text>
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>AI sets the scene for today’s reading</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
        </View>
      </Card>

      {/* Reference lookup */}
      <Card>
        <SectionTitle>Look up a verse</SectionTitle>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            backgroundColor: colors.surfaceAlt,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          }}
        >
          <Ionicons name="search" size={18} color={colors.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. John 3:16 or Romans 12:1-2"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            returnKeyType="search"
            onSubmitEditing={onLookup}
            style={{
              flex: 1,
              color: colors.text,
              fontSize: font.sizes.md,
              paddingVertical: spacing.md,
            }}
          />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Button
            title={loading ? 'Looking up…' : 'Look up verse'}
            onPress={onLookup}
            loading={loading}
            disabled={!query.trim()}
          />
        </View>

        {error ? (
          <Text style={{ color: colors.danger, marginTop: spacing.md }}>{error}</Text>
        ) : null}

        {preview ? (
          <View
            style={{
              marginTop: spacing.lg,
              borderTopWidth: 1,
              borderTopColor: colors.border,
              paddingTop: spacing.lg,
            }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: font.sizes.lg,
                lineHeight: 28,
                fontFamily: isLatinTranslation(preview.translation) ? font.serif : undefined,
              }}
            >
              "{preview.text}"
            </Text>
            <Text style={{ color: colors.primary, fontWeight: '700', marginTop: spacing.sm }}>
              {preview.reference}
              <Text style={{ color: colors.textFaint, fontWeight: '400' }}>
                {'  ·  '}
                {preview.translationName}
                {preview.offline ? '  (offline)' : ''}
              </Text>
            </Text>
            <View style={{ marginTop: spacing.md }}>
              {hasVerse(verseId(preview.reference, preview.translation)) ? (
                <Button title="Already in your library" variant="secondary" disabled />
              ) : (
                <Button
                  title="Save to library"
                  icon={<Ionicons name="bookmark" size={18} color={colors.onPrimary} />}
                  onPress={onSave}
                />
              )}
            </View>
          </View>
        ) : null}
      </Card>

      {/* AI build-a-pack */}
      <AiPackCard translation={translation} serverUrl={serverUrl} />

      {/* Starter packs */}
      <View>
        <SectionTitle>Starter collections</SectionTitle>
        <View style={{ gap: spacing.md }}>
          {STARTER_PACKS.map((pack) => (
            <PackCard key={pack.id} pack={pack} translation={translation} serverUrl={serverUrl} />
          ))}
        </View>
      </View>
    </Screen>
  );
}

function PackCard({
  pack,
  translation,
  serverUrl,
}: {
  pack: StarterPack;
  translation: string;
  serverUrl: string | null;
}) {
  const { colors } = useTheme();
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  const onAdd = async () => {
    setAdding(true);
    try {
      for (const ref of pack.references) {
        try {
          const v = await getVerse(ref, translation, { serverUrl });
          addFetchedVerse(v, pack.id);
        } catch {
          // Skip verses that can't be fetched; keep adding the rest.
        }
      }
      setAdded(true);
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Text style={{ fontSize: 30 }}>{pack.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
            {pack.name}
          </Text>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
            {pack.description}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: 2 }}>
            {pack.references.length} verses
          </Text>
        </View>
        <Pressable
          onPress={onAdd}
          disabled={adding || added}
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: added ? colors.success : colors.primary,
          }}
        >
          {adding ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Ionicons
              name={added ? 'checkmark' : 'add'}
              size={24}
              color={colors.onPrimary}
            />
          )}
        </Pressable>
      </View>
    </Card>
  );
}

function AiPackCard({
  translation,
  serverUrl,
}: {
  translation: string;
  serverUrl: string | null;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);
  const [theme, setTheme] = useState('');
  const [refs, setRefs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSuggest = async () => {
    const t = theme.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    setRefs(null);
    try {
      const suggestions = await suggestPack(serverUrl, t);
      if (suggestions.length === 0) setError('No suggestions — try describing the theme differently.');
      setRefs(suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const onAddAll = async () => {
    if (!refs) return;
    setAdding(true);
    const packId = `ai:${theme.trim().slice(0, 40)}`;
    try {
      for (const ref of refs) {
        try {
          const v = await getVerse(ref, translation, { serverUrl });
          addFetchedVerse(v, packId);
        } catch {
          // Skip any that fail to fetch.
        }
      }
      setRefs(null);
      setTheme('');
      router.push('/library');
    } finally {
      setAdding(false);
    }
  };

  return (
    <Card>
      <SectionTitle>✨ Find verses with Ember</SectionTitle>
      <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm, marginBottom: spacing.sm }}>
        Tell Ember a theme and he’ll suggest verses to hide in your heart.
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
        }}
      >
        <Ionicons name="sparkles-outline" size={18} color={colors.textFaint} />
        <TextInput
          value={theme}
          onChangeText={setTheme}
          placeholder="e.g. courage in hard times"
          placeholderTextColor={colors.textFaint}
          returnKeyType="go"
          onSubmitEditing={onSuggest}
          style={{ flex: 1, color: colors.text, fontSize: font.sizes.md, paddingVertical: spacing.md }}
        />
      </View>
      <View style={{ marginTop: spacing.md }}>
        <Button
          title={loading ? 'Thinking…' : 'Suggest verses'}
          onPress={onSuggest}
          loading={loading}
          disabled={!theme.trim()}
        />
      </View>

      {error ? (
        <Text style={{ color: colors.danger, marginTop: spacing.md }}>{error}</Text>
      ) : null}

      {refs && refs.length > 0 ? (
        <View
          style={{
            marginTop: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingTop: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md }}>
            {refs.map((r) => (
              <View
                key={r}
                style={{
                  paddingVertical: 4,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.pill,
                  backgroundColor: colors.surfaceAlt,
                }}
              >
                <Text style={{ color: colors.text, fontSize: font.sizes.sm, fontWeight: '600' }}>{r}</Text>
              </View>
            ))}
          </View>
          <Button
            title={adding ? 'Adding…' : `Add all ${refs.length}`}
            onPress={onAddAll}
            loading={adding}
            icon={<Ionicons name="bookmark" size={18} color={colors.onPrimary} />}
          />
        </View>
      ) : null}
    </Card>
  );
}
