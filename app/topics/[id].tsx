import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, Chip, EmptyState, SectionTitle } from '@/components/ui';
import { VersePeek } from '@/components/VersePeek';
import { AssetActions } from '@/components/AssetActions';
import { useTheme, spacing, font, radius } from '@/theme';
import { useTopic, useStore } from '@/store/useStore';
import { sortedEntries, composeTopic, type TopicOrder } from '@/utils/topics';
import { hydrateReference } from '@/data/localSearch';

/**
 * A topic: its title and the verses tagged into it. Tap a verse to peek it,
 * long-press to untag. Everything else a topic used to hold (descriptions,
 * reflections, drafts) now lives in Notes.
 */
export default function TopicScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : '';
  const topic = useTopic(id);

  const updateTopic = useStore((s) => s.updateTopic);
  const deleteTopic = useStore((s) => s.deleteTopic);
  const removeFromTopic = useStore((s) => s.removeFromTopic);

  const [order, setOrder] = useState<TopicOrder>('canonical');
  const [peek, setPeek] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const entries = useMemo(() => (topic ? sortedEntries(topic, order) : []), [topic, order]);

  if (!topic) {
    return (
      <Screen>
        <Header title="Topic" back />
        <EmptyState emoji="🏷️" title="Topic not found" subtitle="It may have been deleted." />
      </Screen>
    );
  }

  const untag = (ref: string) => {
    Alert.alert('Remove verse', `Take ${ref} out of “${topic.title}”?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeFromTopic(topic.id, ref) },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert('Delete topic', `Delete “${topic.title}”? The verses stay in your library.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteTopic(topic.id); router.back(); } },
    ]);
  };

  const shareText = composeTopic(topic, (r) => hydrateReference(r)?.text ?? null, order);

  return (
    <Screen>
      <Header
        title={topic.title}
        subtitle={`${topic.entries.length} verse${topic.entries.length === 1 ? '' : 's'}`}
        back
        right={
          <Pressable onPress={() => { setDraft(topic.title); setRenaming(true); }} hitSlop={12} style={{ padding: 4 }}>
            <Ionicons name="pencil" size={18} color={colors.textFaint} />
          </Pressable>
        }
      />

      {renaming ? (
        <Card style={{ gap: spacing.sm }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            autoFocus
            style={{ color: colors.text, fontSize: font.sizes.md, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => setRenaming(false)} />
            <Button
              title="Save"
              small
              style={{ flex: 1 }}
              disabled={!draft.trim()}
              onPress={() => { updateTopic(topic.id, draft); setRenaming(false); }}
            />
          </View>
        </Card>
      ) : null}

      <AssetActions asset={{ kind: 'topic', assetId: topic.id, title: topic.title, text: shareText.slice(0, 400) }} />

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            emoji="📖"
            title="No verses yet"
            subtitle="While you read, tap a verse → “Add to a topic” and pick this one."
          />
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Bible order" active={order === 'canonical'} onPress={() => setOrder('canonical')} />
            <Chip label="Recently added" active={order === 'added'} onPress={() => setOrder('added')} />
          </View>

          <View>
            <SectionTitle>Verses</SectionTitle>
            <View style={{ gap: spacing.sm }}>
              {entries.map((e) => {
                const hit = hydrateReference(e.ref);
                return (
                  <Pressable key={e.ref} onPress={() => setPeek(e.ref)} onLongPress={() => untag(e.ref)} delayLongPress={300}>
                    <Card style={{ gap: 4 }}>
                      <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>{e.ref}</Text>
                      {hit?.text ? (
                        <Text numberOfLines={3} style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 23, fontFamily: font.serif }}>
                          {hit.text}
                        </Text>
                      ) : null}
                    </Card>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginTop: spacing.sm }}>
              Tap to read · long-press to take one out
            </Text>
          </View>
        </>
      )}

      <Button title="Delete topic" variant="ghost" onPress={confirmDelete} />

      <VersePeek reference={peek} onClose={() => setPeek(null)} />
    </Screen>
  );
}
