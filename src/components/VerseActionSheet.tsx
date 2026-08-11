import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, Share, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, spacing, font, radius } from '@/theme';
import { Chip } from '@/components/ui';
import { useStore, useTopicsForRef } from '@/store/useStore';
import { Sheet } from '@/components/Sheet';
import { AssetActions } from '@/components/AssetActions';
import { getVerse, verseId, translationName as translationNameOf, type FetchedVerse } from '@/data/bibleApi';
import { getCrossRefs } from '@/data/crossRefs';
import { AddToTopicSheet } from '@/components/AddToTopicSheet';

/**
 * Bottom-sheet of actions for a single verse — the one hub every verse in the
 * app opens into. Log it, share it to the chat, memorize it, note it, tag it,
 * study it, sing it, or peek its cross-references, all without leaving the
 * chapter you're reading.
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
  const createDoc = useStore((s) => s.createDoc);
  const alreadySaved = useStore((s) => !!s.verses[verseId(reference, translation)]);

  const [peekRef, setPeekRef] = useState<string | null>(null);
  const [peekText, setPeekText] = useState<string | null>(null);
  const [topicOpen, setTopicOpen] = useState(false);
  const topicCount = useTopicsForRef(reference).length;

  const xrefs = reference ? getCrossRefs(reference) : [];

  // Reset transient state whenever a new verse opens the sheet.
  useEffect(() => {
    if (visible) {
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

  const writeNote = () => {
    const id = createDoc('note', { anchorRef: reference, title: reference });
    onClose();
    router.push(`/notes/${id}`);
  };

  const study = () => { onClose(); router.push(`/study/${encodeURIComponent(reference)}`); };
  const songs = () => { onClose(); router.push(`/songbook/verse/${encodeURIComponent(reference)}`); };
  const share = async () => { onClose(); try { await Share.share({ message: `"${text}"\n— ${reference}` }); } catch {} };

  const peek = (r: string) => {
    setPeekRef(r);
    setPeekText(null);
    getVerse(r, 'kjv').then((v) => setPeekText(v.text)).catch(() => setPeekText('Could not load.'));
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={reference}>
      <Text
        numberOfLines={4}
        style={{ color: colors.textMuted, fontSize: font.sizes.sm, fontFamily: font.serif, lineHeight: 22, marginBottom: spacing.md }}
      >
        {text}
      </Text>

      {/* Log it / talk about it — the two actions every asset carries. */}
      <View style={{ marginBottom: spacing.md }}>
        <AssetActions asset={{ kind: 'verse', ref: reference, title: reference, text }} />
      </View>

      {/* Inline cross-reference peek */}
      {peekRef ? (
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.sm }}>{peekRef}</Text>
            <Pressable onPress={() => setPeekRef(null)} hitSlop={8}><Ionicons name="close" size={16} color={colors.textFaint} /></Pressable>
          </View>
          {peekText ? (
            <Text style={{ color: colors.text, fontSize: font.sizes.sm, lineHeight: 22, fontFamily: font.serif, marginTop: 4 }}>{peekText}</Text>
          ) : (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 6 }} />
          )}
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

      <ActionRow icon="sparkles-outline" label={alreadySaved ? 'Open in your library' : 'Memorize this verse'} hint={alreadySaved ? 'Already saved' : 'Hide it in your heart'} color={colors.primary} onPress={memorize} />
      <ActionRow icon="create-outline" label="Write a note" hint="A note in your workspace, linked to this verse" color={colors.success} onPress={writeNote} />
      <ActionRow
        icon="pricetag-outline"
        label="Add to a topic"
        hint={topicCount > 0 ? `In ${topicCount} ${topicCount === 1 ? 'topic' : 'topics'}` : 'Gather it under a theme'}
        color={colors.warning}
        onPress={() => setTopicOpen(true)}
      />
      <ActionRow icon="book-outline" label="Study this passage" hint="Setting, people, cross-refs" color={colors.accent} onPress={study} />
      <ActionRow icon="musical-notes-outline" label="Songs from this verse" hint="Hymns it inspired — sing the Word" color={colors.accent} onPress={songs} />
      <ActionRow icon="share-outline" label="Share outside the app" hint="Send to anyone" color={colors.textMuted} onPress={share} />

      <AddToTopicSheet visible={topicOpen} onClose={() => setTopicOpen(false)} reference={reference} />
    </Sheet>
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
