import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Header } from '@/components/layout';
import { EmptyState } from '@/components/ui';
import { RefText } from '@/components/RefText';
import { PeekableRef } from '@/components/PeekableRef';
import { AttachSheet } from '@/components/AttachSheet';
import { EmberTip } from '@/components/EmberGuide';
import { ReactionBar } from '@/components/ReactionBar';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useStore } from '@/store/useStore';
import { matchHymnByTitle } from '@/data/hymns';
import type { Message, MessageAttachment } from '@/types';

/**
 * The circle conversation — a chat reimagined for people who talk Scripture.
 * The "+" tray gives fingertip access to the Bible (search any verse), your
 * memorized verses, your notes, and your songbook; attachments ride the message
 * as rich, peekable cards the partner can adopt into their own study.
 */
export default function DiscussionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; context?: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const context = typeof params.context === 'string' && params.context ? decodeURIComponent(params.context) : null;
  const circle = useCircle(code);
  const myId = useStore((s) => s.profile.memberId);
  const refreshCircle = useStore((s) => s.refreshCircle);
  const postCircleMessage = useStore((s) => s.postCircleMessage);
  const deleteCircleMessage = useStore((s) => s.deleteCircleMessage);
  const adoptVerse = useStore((s) => s.adoptVerse);
  const adoptReflection = useStore((s) => s.adoptReflection);

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<MessageAttachment[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  // When opened on a verse, default to that thread; a toggle shows the whole board.
  const [scope, setScope] = useState<'context' | 'all'>(context ? 'context' : 'all');
  const listRef = useRef<FlatList<Message>>(null);
  const allMessages = circle?.messages ?? [];
  const key = context ? context.trim().replace(/\s+/g, ' ').toLowerCase() : null;
  const messages = context && scope === 'context'
    ? allMessages.filter((m) => (m.context ?? '').trim().replace(/\s+/g, ' ').toLowerCase() === key)
    : allMessages;

  useEffect(() => { refreshCircle(code).catch(() => {}); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Near-live: poll for new messages while the screen is open (the dyad cadence).
  useEffect(() => {
    const id = setInterval(() => refreshCircle(code).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const t = draft.trim();
    if (!t && pending.length === 0) return;
    postCircleMessage(code, t, scope === 'context' && context ? context : undefined, pending.length ? pending : undefined).catch(() => {});
    setDraft('');
    setPending([]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
  };

  const confirmDelete = (m: Message) =>
    Alert.alert('Delete message?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteCircleMessage(code, m.msgId) },
    ]);

  const saveVerse = (a: MessageAttachment) => {
    if (!a.ref) return;
    adoptVerse(a.ref).then(() => Alert.alert('Added to your library', `${a.ref} is now in your verses.`)).catch(() => {});
  };
  const saveNote = (a: MessageAttachment, byName: string) => {
    adoptReflection(a.text ?? a.title ?? '', byName, a.ref);
    Alert.alert('Saved to your notes 💛');
  };
  const openSong = (title: string) => {
    const h = matchHymnByTitle(title);
    if (h) router.push(`/hymns/${h.id}`);
    else router.push(`/songs?q=${encodeURIComponent(title)}`);
  };

  const renderItem = ({ item: m }: { item: Message }) => {
    const mine = m.by === myId;
    return (
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: spacing.sm }}>
        {!mine ? <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginBottom: 2, marginLeft: 4 }}>{m.byName}</Text> : null}
        <Pressable
          onLongPress={mine ? () => confirmDelete(m) : undefined}
          style={{ maxWidth: '86%', backgroundColor: mine ? colors.primary : colors.surface, borderWidth: mine ? 0 : 1, borderColor: colors.border, borderRadius: radius.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, gap: spacing.sm }}
        >
          {m.text ? <RefText text={m.text} style={{ color: mine ? colors.onPrimary : colors.text }} refColor={mine ? colors.onPrimary : colors.primary} /> : null}
          {(m.attachments ?? []).map((a, i) => (
            <AttachmentCard key={i} a={a} mine={mine} byName={m.byName} onSaveVerse={() => saveVerse(a)} onSaveNote={() => saveNote(a, m.byName)} onOpenSong={() => a.title && openSong(a.title)} />
          ))}
        </Pressable>
        <ReactionBar code={code} targetType="message" targetId={m.msgId} />
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md }}>
        <Header title="Discussion" subtitle={circle?.meta.name ? `${circle.meta.name} · talk it through` : 'Talk it through'} back />
        {context ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, flex: 1 }}>
              {scope === 'context' ? `On ${context}` : 'Whole board'}
            </Text>
            <Pressable onPress={() => setScope((s) => (s === 'context' ? 'all' : 'context'))} hitSlop={8} style={{ paddingVertical: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
              <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '800' }}>{scope === 'context' ? 'See whole board' : `Back to ${context}`}</Text>
            </Pressable>
          </View>
        ) : null}
        <EmberTip topic="discussion" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={8}>
        {messages.length === 0 ? (
          <EmptyState emoji="💬" title="No messages yet" subtitle="Start the conversation — tap ＋ to bring a verse, a note, or a song straight into the chat." />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.msgId}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Pending attachments preview */}
        {pending.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
            {pending.map((a, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}>
                <Ionicons name={a.kind === 'verse' ? 'book-outline' : a.kind === 'note' ? 'document-text-outline' : 'musical-notes-outline'} size={13} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{a.ref ?? a.title}</Text>
                <Pressable onPress={() => setPending((p) => p.filter((_, j) => j !== i))} hitSlop={6}>
                  <Ionicons name="close-circle" size={15} color={colors.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, padding: spacing.md, borderTopWidth: pending.length ? 0 : 1, borderTopColor: colors.border, backgroundColor: colors.surface }}>
          <Pressable onPress={() => setTrayOpen(true)} hitSlop={6} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={{ flex: 1, color: colors.text, fontSize: font.sizes.md, maxHeight: 120, backgroundColor: colors.surfaceAlt, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
          />
          <Pressable onPress={send} disabled={!draft.trim() && pending.length === 0} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: draft.trim() || pending.length ? colors.primary : colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="send" size={18} color={draft.trim() || pending.length ? colors.onPrimary : colors.textFaint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <AttachSheet visible={trayOpen} onClose={() => setTrayOpen(false)} onAttach={(a) => setPending((p) => (p.length >= 5 ? p : [...p, a]))} />
    </SafeAreaView>
  );
}

/** A rich attachment card inside a bubble: verse (peekable + save), note (save), song (open). */
function AttachmentCard({
  a,
  mine,
  byName,
  onSaveVerse,
  onSaveNote,
  onOpenSong,
}: {
  a: MessageAttachment;
  mine: boolean;
  byName: string;
  onSaveVerse: () => void;
  onSaveNote: () => void;
  onOpenSong: () => void;
}) {
  const { colors } = useTheme();
  const bg = mine ? 'rgba(255,255,255,0.14)' : colors.surfaceAlt;
  const fg = mine ? colors.onPrimary : colors.text;
  const faint = mine ? colors.onPrimary : colors.textFaint;

  if (a.kind === 'song') {
    return (
      <Pressable onPress={onOpenSong} style={{ backgroundColor: bg, borderRadius: radius.md, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Ionicons name="musical-notes" size={16} color={fg} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: fg, fontWeight: '800', fontSize: font.sizes.sm }}>{a.title}</Text>
          {a.ref ? <Text style={{ color: faint, fontSize: font.sizes.xs, opacity: 0.85 }}>{a.ref}</Text> : null}
        </View>
        <Ionicons name="play-circle-outline" size={18} color={fg} />
      </Pressable>
    );
  }

  if (a.kind === 'note') {
    return (
      <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: spacing.sm, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="document-text" size={14} color={fg} />
          <Text style={{ flex: 1, color: fg, fontWeight: '800', fontSize: font.sizes.sm }}>{a.title || 'A note'}</Text>
        </View>
        {a.text ? <Text numberOfLines={4} style={{ color: fg, fontSize: font.sizes.xs, lineHeight: 18, opacity: 0.92 }}>{a.text}</Text> : null}
        {!mine ? (
          <Pressable onPress={onSaveNote} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
            <Ionicons name="download-outline" size={13} color={fg} />
            <Text style={{ color: fg, fontSize: font.sizes.xs, fontWeight: '800' }}>Save to my notes</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // verse
  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: spacing.sm, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="book" size={13} color={fg} />
        {a.ref ? (mine ? <Text style={{ color: fg, fontWeight: '800', fontSize: font.sizes.sm }}>{a.ref}</Text> : <PeekableRef reference={a.ref} tone="plain" />) : null}
      </View>
      {a.text ? <Text style={{ color: fg, fontSize: font.sizes.sm, lineHeight: 21, fontFamily: font.serif, opacity: 0.95 }}>{a.text}</Text> : null}
      {!mine && a.ref ? (
        <Pressable onPress={onSaveVerse} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}>
          <Ionicons name="add-circle-outline" size={14} color={fg} />
          <Text style={{ color: fg, fontSize: font.sizes.xs, fontWeight: '800' }}>Memorize this</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
