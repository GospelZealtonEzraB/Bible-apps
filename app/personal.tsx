import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Button, SectionTitle, EmptyState } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { useTheme, spacing, font, radius } from '@/theme';
import { useStore, useTopicList } from '@/store/useStore';
import { relativeTimeAgo } from '@/utils/date';
import { usePaged, PageMore } from '@/components/Paginated';

/**
 * Personal Space — the private sanctuary. Everything here lives only on this
 * device (until you choose to share it): private notes, your study topics, your
 * "living it out" commitments, and free reflections. Nothing syncs to a circle.
 */
export default function PersonalSpaceScreen() {
  const { colors } = useTheme();
  const router = useRouter();

  const notesMap = useStore((s) => s.notes);
  const applicationsMap = useStore((s) => s.applications);
  const addPrivateNote = useStore((s) => s.addPrivateNote);
  const deletePrivateNote = useStore((s) => s.deletePrivateNote);
  const topics = useTopicList();

  const notes = useMemo(() => Object.values(notesMap).sort((a, b) => b.updatedAt - a.updatedAt), [notesMap]);
  const applications = useMemo(() => Object.values(applicationsMap).sort((a, b) => b.createdAt - a.createdAt), [applicationsMap]);
  const notePage = usePaged(notes, 15, notes.length);

  const [draft, setDraft] = useState('');
  const [writing, setWriting] = useState(false);

  const saveReflection = () => {
    if (!draft.trim()) return;
    addPrivateNote('free', draft);
    setDraft('');
    setWriting(false);
  };

  const confirmDelete = (noteId: string) =>
    Alert.alert('Delete reflection?', 'This is private to you.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePrivateNote(noteId) },
    ]);

  const empty = notes.length === 0 && applications.length === 0 && topics.length === 0;

  return (
    <Screen>
      <Header title="Personal Space" subtitle="Private to you — never shared unless you choose" back />

      {/* Quick reflection */}
      {writing ? (
        <Card style={{ gap: spacing.sm }}>
          <SectionTitle>New reflection</SectionTitle>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="What is the Lord showing you? A prayer, a wrestling, a quiet thought…"
            placeholderTextColor={colors.textFaint}
            multiline
            autoFocus
            textAlignVertical="top"
            style={{ color: colors.text, fontSize: font.sizes.md, minHeight: 100, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Cancel" variant="ghost" small style={{ flex: 1 }} onPress={() => { setDraft(''); setWriting(false); }} />
            <Button title="Save privately" small style={{ flex: 1 }} disabled={!draft.trim()} onPress={saveReflection} />
          </View>
        </Card>
      ) : (
        <Button title="New reflection" icon={<Ionicons name="create-outline" size={18} color={colors.onPrimary} />} onPress={() => setWriting(true)} />
      )}

      {empty ? (
        <EmptyState emoji="🔒" title="Your private sanctuary" subtitle="Reflections, private notes, study topics, and your ‘living it out’ commitments gather here — for your eyes only." />
      ) : null}

      {/* Topics */}
      {topics.length > 0 ? (
        <View>
          <SectionTitle>Study topics</SectionTitle>
          <Card onPress={() => router.push('/topics')} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="pricetag-outline" size={20} color={colors.warning} />
            <Text style={{ flex: 1, color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{topics.length} topic{topics.length === 1 ? '' : 's'}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </Card>
        </View>
      ) : null}

      {/* Living it out */}
      {applications.length > 0 ? (
        <View>
          <SectionTitle>Living it out</SectionTitle>
          <View style={{ gap: spacing.sm }}>
            {applications.slice(0, 5).map((a) => (
              <Card key={a.passageKey} onPress={() => router.push(`/study/${encodeURIComponent(a.passage)}`)}>
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{a.passage}</Text>
                <Text style={{ color: colors.text, fontSize: font.sizes.md, marginTop: 2 }}>✅ {a.text}</Text>
              </Card>
            ))}
          </View>
        </View>
      ) : null}

      {/* Private notes & reflections */}
      {notes.length > 0 ? (
        <View>
          <SectionTitle>Notes & reflections</SectionTitle>
          <View style={{ gap: spacing.sm }}>
            {notePage.shown.map((n) => (
              <Card key={n.noteId} style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, color: colors.textFaint, fontSize: font.sizes.xs }}>
                    {n.ref ? n.ref : 'Reflection'} · {relativeTimeAgo(n.updatedAt)}
                  </Text>
                  <Pressable onPress={() => confirmDelete(n.noteId)} hitSlop={8}><Ionicons name="trash-outline" size={15} color={colors.textFaint} /></Pressable>
                </View>
                <RefText text={n.text} />
              </Card>
            ))}
            <PageMore remaining={notePage.remaining} step={15} onPress={notePage.showMore} noun="more" />
          </View>
        </View>
      ) : null}

      <Text style={{ color: colors.textFaint, fontSize: 10, textAlign: 'center' }}>
        🔒 Everything here stays on your device and in your private backup — never in a circle.
      </Text>
    </Screen>
  );
}
