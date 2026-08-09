import React, { useEffect, useState } from 'react';
import { Modal, View, Text, Pressable, Share, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, font, radius } from '@/theme';
import { Chip } from '@/components/ui';
import { useStore, useTopicsForRef } from '@/store/useStore';
import { getVerse, verseId, translationName as translationNameOf, type FetchedVerse } from '@/data/bibleApi';
import { getCrossRefs } from '@/data/crossRefs';
import { AddToTopicSheet } from '@/components/AddToTopicSheet';

/**
 * Bottom-sheet of actions for a single verse — the "from anywhere to memorized"
 * hub. Now self-contained for the reader: memorize, a quick inline note, inline
 * cross-references you can peek, study, and share — without leaving the chapter.
 */
export function VerseActionSheet({
  visible,
  onClose,
  reference,
  text,
  translation,
}: {
  visible: boolean;
  onClose: () => void;
  reference: string;
  text: string;
  translation: string;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const addFetchedVerse = useStore((s) => s.addFetchedVerse);
  const addPrivateNote = useStore((s) => s.addPrivateNote);
  const alreadySaved = useStore((s) => !!s.verses[verseId(reference, translation)]);

  const [noteDraft, setNoteDraft] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [peekRef, setPeekRef] = useState<string | null>(null);
  const [peekText, setPeekText] = useState<string | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);
  const topicCount = useTopicsForRef(reference).length;

  const xrefs = reference ? getCrossRefs(reference) : [];

  // Reset transient state whenever a new verse opens the sheet.
  useEffect(() => {
    if (visible) {
      setNoteDraft('');
      setNoteOpen(false);
      setSaved(false);
      setPeekRef(null);
      setPeekText(null);
      setTopicOpen(false);
    }
  }, [visible, reference]);

  const memorize = () => {
    if (!alreadySaved) {
      const fetched: FetchedVerse = { reference, text, translation, translationName: translationNameOf(translation), offline: false };
      addFetchedVerse(fetched);
    }
    onClose();
    router.push(`/verse/${encodeURIComponent(verseId(reference, translation))}`);
  };

  const saveNote = () => {
    if (!noteDraft.trim()) return;
    addPrivateNote('verse', noteDraft, reference);
    setNoteDraft('');
    setNoteOpen(false);
    setSaved(true);
  };

  const study = () => { onClose(); router.push(`/study/${encodeURIComponent(reference)}`); };
  const songs = () => { onClose(); router.push(`/hymns/verse/${encodeURIComponent(reference)}`); };
  const share = async () => { onClose(); try { await Share.share({ message: `"${text}"\n— ${reference}` }); } catch {} };

  const peek = (r: string) => {
    setPeekRef(r);
    setPeekText(null);
    getVerse(r, 'kjv').then((v) => setPeekText(v.text)).catch(() => setPeekText('Could not load.'));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={onClose}>
          <Pressable
            style={{ backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xs }}
            onPress={() => {}}
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>{reference}</Text>
            <Text numberOfLines={2} style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontFamily: font.serif, marginBottom: spacing.sm }}>{text}</Text>

            {/* Inline cross-reference peek */}
            {peekRef ? (
              <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>{peekRef}</Text>
                  <Pressable onPress={() => setPeekRef(null)} hitSlop={8}><Ionicons name="close" size={16} color={colors.textFaint} /></Pressable>
                </View>
                {peekText ? <Text style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22, fontFamily: font.serif, marginTop: 4 }}>{peekText}</Text> : <ActivityIndicator color={colors.primary} style={{ marginTop: 6 }} />}
              </View>
            ) : null}

            {xrefs.length > 0 ? (
              <View style={{ marginBottom: spacing.sm, gap: 6 }}>
                <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>CROSS-REFERENCES</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {xrefs.slice(0, 6).map((r) => <Chip key={r} label={r} active={peekRef === r} onPress={() => peek(r)} />)}
                </View>
              </View>
            ) : null}

            {/* Quick note */}
            {noteOpen ? (
              <View style={{ gap: spacing.sm, marginBottom: spacing.sm }}>
                <TextInput
                  value={noteDraft}
                  onChangeText={setNoteDraft}
                  placeholder="What are you seeing here?"
                  placeholderTextColor={colors.textFaint}
                  multiline
                  autoFocus
                  textAlignVertical="top"
                  style={{ color: colors.text, fontSize: font.sizes.md, minHeight: 60, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}
                />
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Pressable onPress={() => setNoteOpen(false)} style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center' }}>
                    <Text style={{ color: colors.textFaint, fontWeight: '700' }}>Cancel</Text>
                  </Pressable>
                  <Pressable onPress={saveNote} style={{ flex: 1, paddingVertical: spacing.sm, alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.md }}>
                    <Text style={{ color: colors.onPrimary, fontWeight: '800' }}>Save note</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            <ActionRow icon="sparkles-outline" label={alreadySaved ? 'Open in your library' : 'Memorize this verse'} hint={alreadySaved ? 'Already saved' : 'Hide it in your heart'} color={colors.primary} onPress={memorize} />
            {!noteOpen ? (
              <ActionRow
                icon={saved ? 'checkmark-circle-outline' : 'create-outline'}
                label={saved ? 'Note saved' : 'Add a note'}
                hint={saved ? 'In your private notes' : 'Record what you’re seeing'}
                color={colors.success}
                onPress={() => { setSaved(false); setNoteOpen(true); }}
              />
            ) : null}
            <ActionRow
              icon="pricetag-outline"
              label="Add to a topic"
              hint={topicCount > 0 ? `In ${topicCount} ${topicCount === 1 ? 'topic' : 'topics'}` : 'Collect it into a study thread'}
              color={colors.warning}
              onPress={() => setTopicOpen(true)}
            />
            <ActionRow icon="book-outline" label="Study this passage" hint="Setting, people, cross-refs" color={colors.accent} onPress={study} />
            <ActionRow icon="musical-notes-outline" label="Songs from this verse" hint="Hymns it inspired — sing the Word" color={colors.accent} onPress={songs} />
            <ActionRow icon="share-outline" label="Share" hint="Send to a friend" color={colors.textMuted} onPress={share} />

            <Pressable onPress={onClose} style={{ paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs }}>
              <Text style={{ color: colors.textFaint, fontWeight: '700', fontSize: font.sizes.md }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
      <AddToTopicSheet visible={topicOpen} onClose={() => setTopicOpen(false)} reference={reference} />
    </Modal>
  );
}

function ActionRow({ icon, label, hint, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; hint: string; color: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radius.lg, backgroundColor: pressed ? colors.surfaceAlt : 'transparent' })}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{label}</Text>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}
