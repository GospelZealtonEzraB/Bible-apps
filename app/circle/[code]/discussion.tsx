import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { RefText } from '@/components/RefText';
import { PeekableRef } from '@/components/PeekableRef';
import { AttachSheet } from '@/components/AttachSheet';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useStore, useSongbook } from '@/store/useStore';
import { matchSongByTitle } from '@/data/songbook';
import { buildTimeline, clockTime, type TimelineItem } from '@/utils/chatTimeline';
import { prettyDay } from '@/utils/date';
import type { Challenge, Message, MessageAttachment, Prayer } from '@/types';

/**
 * The conversation — and, for a covenant partnership, the whole "together"
 * surface. Everything you'd otherwise leave the page for happens in the thread:
 * prayer requests and challenges are cards in the stream, the covenant is
 * pinned at the top, and the ＋ tray brings the Bible, your verses, your notes
 * and your songbook to your fingertips.
 *
 * Built to feel like a chat app, not a form: the composer sits above the
 * keyboard, the list is inverted so it stays pinned to the newest message,
 * runs from the same person group into one turn, and days are separated.
 */
export default function DiscussionScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code: string; context?: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const context =
    typeof params.context === 'string' && params.context ? decodeURIComponent(params.context) : null;

  const circle = useCircle(code);
  const songbook = useSongbook();
  const myId = useStore((s) => s.profile.memberId);
  const refreshCircle = useStore((s) => s.refreshCircle);
  const postCircleMessage = useStore((s) => s.postCircleMessage);
  const deleteCircleMessage = useStore((s) => s.deleteCircleMessage);
  const adoptVerse = useStore((s) => s.adoptVerse);
  const adoptReflection = useStore((s) => s.adoptReflection);
  const addPrayer = useStore((s) => s.addPrayer);
  const togglePrayed = useStore((s) => s.togglePrayed);
  const answerPrayer = useStore((s) => s.answerPrayer);
  const pendingChatAttachment = useStore((s) => s.pendingChatAttachment);
  const setPendingChatAttachment = useStore((s) => s.setPendingChatAttachment);

  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<MessageAttachment[]>([]);
  const [trayOpen, setTrayOpen] = useState(false);
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [prayerDraft, setPrayerDraft] = useState('');
  const [atBottom, setAtBottom] = useState(true);
  const [scope, setScope] = useState<'context' | 'all'>(context ? 'context' : 'all');

  const listRef = useRef<FlatList<TimelineItem>>(null);

  const partner = useMemo(
    () => (circle?.members ?? []).find((m) => m.id !== myId),
    [circle?.members, myId],
  );

  // Oldest-first from the builder; the list is inverted, so render newest-first.
  const timeline = useMemo(
    () =>
      buildTimeline({
        messages: circle?.messages ?? [],
        prayers: circle?.prayers ?? [],
        challenges: circle?.challenges ?? [],
        context: scope === 'context' ? context : null,
      }),
    [circle?.messages, circle?.prayers, circle?.challenges, context, scope],
  );
  const inverted = useMemo(() => [...timeline].reverse(), [timeline]);

  useEffect(() => { refreshCircle(code).catch(() => {}); }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Near-live: poll while the thread is open (the right cadence for two people).
  useEffect(() => {
    const id = setInterval(() => refreshCircle(code).catch(() => {}), 15000);
    return () => clearInterval(id);
  }, [code]); // eslint-disable-line react-hooks/exhaustive-deps

  // An asset shared from anywhere else in the app arrives as a pending chip.
  useEffect(() => {
    if (!pendingChatAttachment) return;
    setPending((p) => (p.length >= 5 ? p : [...p, pendingChatAttachment]));
    setPendingChatAttachment(null);
  }, [pendingChatAttachment]); // eslint-disable-line react-hooks/exhaustive-deps

  const send = () => {
    const t = draft.trim();
    if (!t && pending.length === 0) return;
    void postCircleMessage(
      code,
      t,
      scope === 'context' && context ? context : undefined,
      pending.length ? pending : undefined,
    ).catch(() => {});
    setDraft('');
    setPending([]);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const sendPrayer = () => {
    const t = prayerDraft.trim();
    if (!t) return;
    void addPrayer(code, t).catch(() => {});
    setPrayerDraft('');
    setPrayerOpen(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const messageActions = (m: Message) => {
    const mine = m.by === myId;
    Alert.alert(mine ? 'Your message' : m.byName, m.text?.slice(0, 120) || undefined, [
      ...(mine
        ? [{ text: 'Delete', style: 'destructive' as const, onPress: () => deleteCircleMessage(code, m.msgId) }]
        : []),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const saveVerse = (a: MessageAttachment) => {
    if (!a.ref) return;
    adoptVerse(a.ref)
      .then(() => Alert.alert('Added to your library', `${a.ref} is now in your verses.`))
      .catch(() => {});
  };
  const saveNote = (a: MessageAttachment, byName: string) => {
    adoptReflection(a.text ?? a.title ?? '', byName, a.ref);
    Alert.alert('Saved to your notes 💛');
  };
  const openSong = (title: string) => {
    const h = matchSongByTitle(title, songbook);
    router.push(h ? `/songbook/${h.id}` : `/songbook?q=${encodeURIComponent(title)}`);
  };

  const renderItem = useCallback(
    ({ item }: { item: TimelineItem }) => {
      if (item.kind === 'day') return <DaySeparator day={item.day} />;
      if (item.kind === 'prayer') {
        return (
          <PrayerCard
            prayer={item.prayer}
            mine={item.prayer.by === myId}
            onPray={() => togglePrayed(code, item.prayer).catch(() => {})}
            onAnswer={() =>
              Alert.alert('Answered?', 'Mark this prayer as answered — a record of what He did.', [
                { text: 'Not yet', style: 'cancel' },
                { text: 'He answered', onPress: () => answerPrayer(code, item.prayer.prayerId).catch(() => {}) },
              ])
            }
          />
        );
      }
      if (item.kind === 'challenge') {
        return (
          <ChallengeCard
            challenge={item.challenge}
            forMe={item.challenge.to === myId}
            onTake={() => router.push(`/challenge/${code}/${item.challenge.chalId}`)}
          />
        );
      }

      const m = item.message;
      const mine = m.by === myId;
      return (
        <View
          style={{
            alignItems: mine ? 'flex-end' : 'flex-start',
            marginBottom: item.lastOfGroup ? spacing.sm : 2,
            paddingHorizontal: spacing.md,
          }}
        >
          {!mine && !item.grouped ? (
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, marginBottom: 2, marginLeft: spacing.sm }}>
              {m.byName}
            </Text>
          ) : null}
          <Pressable
            onLongPress={() => messageActions(m)}
            delayLongPress={300}
            style={{
              maxWidth: '84%',
              backgroundColor: mine ? colors.primary : colors.surface,
              borderWidth: mine ? 0 : 1,
              borderColor: colors.border,
              borderRadius: radius.lg,
              // Square off the corner nearest the tail on the last of a run.
              borderBottomRightRadius: mine && item.lastOfGroup ? 4 : radius.lg,
              borderBottomLeftRadius: !mine && item.lastOfGroup ? 4 : radius.lg,
              paddingVertical: spacing.sm,
              paddingHorizontal: spacing.md,
              gap: spacing.sm,
            }}
          >
            {m.text ? (
              <RefText
                text={m.text}
                style={{ color: mine ? colors.onPrimary : colors.text, fontSize: font.sizes.md, lineHeight: 22 }}
                refColor={mine ? colors.onPrimary : colors.primary}
              />
            ) : null}
            {(m.attachments ?? []).map((a, i) => (
              <AttachmentCard
                key={i}
                a={a}
                mine={mine}
                onSaveVerse={() => saveVerse(a)}
                onSaveNote={() => saveNote(a, m.byName)}
                onOpenSong={() => a.title && openSong(a.title)}
              />
            ))}
            {item.lastOfGroup ? (
              <Text
                style={{
                  color: mine ? colors.onPrimary : colors.textFaint,
                  opacity: mine ? 0.75 : 1,
                  fontSize: 10,
                  alignSelf: 'flex-end',
                  marginTop: -2,
                }}
              >
                {clockTime(m.at)}
              </Text>
            ) : null}
          </Pressable>
        </View>
      );
    },
    [myId, code, colors, songbook], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const covenant = circle?.meta?.covenant;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header — tapping the partner opens their log and shelf. */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: colors.surface,
        }}
      >
        <Pressable onPress={() => router.back()} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Pressable
          onPress={() => partner && router.push(`/partner/${code}/${partner.id}`)}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
        >
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: font.sizes.md }}>
              {(partner?.displayName ?? '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
              {partner?.displayName ?? circle?.meta.name ?? 'Your partner'}
            </Text>
            <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
              {partner ? 'Tap for their log & shelf' : `Invite code ${circle?.meta.code ?? ''}`}
            </Text>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push(`/circle/${code}/settings`)} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textFaint} />
        </Pressable>
      </View>

      {/* Pinned covenant — the commitment you keep in view. */}
      {covenant?.goalText ? (
        <Pressable
          onPress={() => router.push(`/circle/${code}/settings`)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primarySoft }}
        >
          <Ionicons name="bookmark" size={14} color={colors.primary} />
          <Text numberOfLines={1} style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700', flex: 1 }}>
            {covenant.goalText}
            {covenant.cadenceLabel ? ` · ${covenant.cadenceLabel}` : ''}
          </Text>
        </Pressable>
      ) : null}

      {/* Anchored-thread toggle */}
      {context ? (
        <Pressable
          onPress={() => setScope((s) => (s === 'context' ? 'all' : 'context'))}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: 6, backgroundColor: colors.surfaceAlt }}
        >
          <Ionicons name="return-down-forward" size={13} color={colors.textFaint} />
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.xs, flex: 1 }}>
            {scope === 'context' ? `Only about ${context}` : 'Whole conversation'}
          </Text>
          <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '800' }}>
            {scope === 'context' ? 'Show all' : `Back to ${context}`}
          </Text>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={insets.top + 56}
      >
        <View style={{ flex: 1 }}>
          {inverted.length === 0 ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }}>
              <Text style={{ fontSize: 40 }}>💬</Text>
              <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.lg }}>Say the first thing</Text>
              <Text style={{ color: colors.textMuted, textAlign: 'center', maxWidth: 280, lineHeight: 21 }}>
                Tap ＋ to bring a verse, a note, a song, or a prayer request straight into the conversation.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={inverted}
              inverted
              keyExtractor={(i) => i.id}
              renderItem={renderItem}
              contentContainerStyle={{ paddingVertical: spacing.md }}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScroll={(e) => setAtBottom(e.nativeEvent.contentOffset.y < 120)}
              scrollEventThrottle={64}
              initialNumToRender={20}
            />
          )}

          {/* Jump back to the newest, the way every chat app offers. */}
          {!atBottom ? (
            <Pressable
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              style={{
                position: 'absolute',
                right: spacing.md,
                bottom: spacing.md,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: colors.surface,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="chevron-down" size={20} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        {/* Pending attachments */}
        {pending.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: colors.surface }}>
            {pending.map((a, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: colors.primarySoft }}>
                <Ionicons
                  name={a.kind === 'verse' ? 'book-outline' : a.kind === 'note' ? 'document-text-outline' : 'musical-notes-outline'}
                  size={13}
                  color={colors.primary}
                />
                <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>{a.ref ?? a.title}</Text>
                <Pressable onPress={() => setPending((p) => p.filter((_, j) => j !== i))} hitSlop={6}>
                  <Ionicons name="close-circle" size={15} color={colors.primary} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* Composer — always above the keyboard */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: spacing.sm,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: Math.max(insets.bottom, spacing.sm),
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Pressable
            onPress={() => setTrayOpen(true)}
            hitSlop={6}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="add" size={22} color={colors.primary} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Message…"
            placeholderTextColor={colors.textFaint}
            multiline
            style={{
              flex: 1,
              color: colors.text,
              fontSize: font.sizes.md,
              lineHeight: 21,
              minHeight: 40,
              maxHeight: 120,
              backgroundColor: colors.surfaceAlt,
              borderRadius: radius.xl,
              paddingHorizontal: spacing.md,
              paddingTop: 10,
              paddingBottom: 10,
            }}
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim() && pending.length === 0}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: draft.trim() || pending.length ? colors.primary : colors.surfaceAlt,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="send" size={17} color={draft.trim() || pending.length ? colors.onPrimary : colors.textFaint} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <AttachSheet
        visible={trayOpen}
        onClose={() => setTrayOpen(false)}
        onAttach={(a) => setPending((p) => (p.length >= 5 ? p : [...p, a]))}
        onPrayer={() => { setTrayOpen(false); setPrayerOpen(true); }}
        onChallenge={
          partner
            ? () => { setTrayOpen(false); router.push(`/circle/${code}/challenge?to=${partner.id}`); }
            : undefined
        }
      />

      {/* Ask for prayer — posts a card into the thread. */}
      <Sheet visible={prayerOpen} onClose={() => setPrayerOpen(false)} title="Ask for prayer" subtitle="It appears in the conversation, and stays until He answers.">
        <TextInput
          value={prayerDraft}
          onChangeText={setPrayerDraft}
          placeholder="What can they pray with you about?"
          placeholderTextColor={colors.textFaint}
          multiline
          autoFocus
          textAlignVertical="top"
          style={{ color: colors.text, fontSize: font.sizes.md, minHeight: 90, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md }}
        />
        <Button title="Ask" disabled={!prayerDraft.trim()} onPress={sendPrayer} />
      </Sheet>
    </SafeAreaView>
  );
}

/** The date chip between days, as every chat app has. */
function DaySeparator({ day }: { day: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', marginVertical: spacing.md }}>
      <View style={{ paddingVertical: 4, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: colors.surfaceAlt }}>
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700' }}>{prettyDay(day)}</Text>
      </View>
    </View>
  );
}

/** A prayer request, living in the stream like a poll would. */
function PrayerCard({
  prayer,
  mine,
  onPray,
  onAnswer,
}: {
  prayer: Prayer;
  mine: boolean;
  onPray: () => void;
  onAnswer: () => void;
}) {
  const { colors } = useTheme();
  const answered = prayer.status === 'answered';
  return (
    <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: answered ? colors.success : colors.border,
          borderLeftWidth: 3,
          borderLeftColor: answered ? colors.success : colors.accent,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13 }}>{answered ? '🙌' : '🙏'}</Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '800', flex: 1 }}>
            {answered ? 'ANSWERED' : `${mine ? 'You' : prayer.byName} asked for prayer`}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 10 }}>{clockTime(prayer.createdAt)}</Text>
        </View>
        <Text style={{ color: colors.text, fontSize: font.sizes.md, lineHeight: 22 }}>{prayer.text}</Text>
        {prayer.answerNote ? (
          <Text style={{ color: colors.success, fontSize: font.sizes.sm, fontStyle: 'italic' }}>{prayer.answerNote}</Text>
        ) : null}
        {!answered ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 2 }}>
            {!mine ? (
              <Pressable onPress={onPray} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name={prayer.didIPray ? 'checkmark-circle' : 'heart-outline'} size={16} color={prayer.didIPray ? colors.success : colors.primary} />
                <Text style={{ color: prayer.didIPray ? colors.success : colors.primary, fontSize: font.sizes.sm, fontWeight: '800' }}>
                  {prayer.didIPray ? 'Prayed' : 'I prayed'}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={onAnswer} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="sparkles-outline" size={15} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: font.sizes.sm, fontWeight: '800' }}>He answered</Text>
              </Pressable>
            )}
            {prayer.prayedByCount > 0 ? (
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>
                prayed for {prayer.prayedByCount}×
              </Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** A challenge, also a card in the stream — "take it" opens the drill. */
function ChallengeCard({
  challenge,
  forMe,
  onTake,
}: {
  challenge: Challenge;
  forMe: boolean;
  onTake: () => void;
}) {
  const { colors } = useTheme();
  const done = challenge.status !== 'pending';
  return (
    <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 3,
          borderLeftColor: colors.warning,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: 6,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontSize: 13 }}>🎯</Text>
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '800', flex: 1 }}>
            {forMe ? `${challenge.fromName} challenged you` : `You challenged ${challenge.toName}`}
          </Text>
          <Text style={{ color: colors.textFaint, fontSize: 10 }}>{clockTime(challenge.createdAt)}</Text>
        </View>
        <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{challenge.reference}</Text>
        {done ? (
          <Text style={{ color: colors.success, fontSize: font.sizes.sm }}>
            {challenge.status === 'submitted' ? 'Answered — waiting on a reply' : 'Done, and encouraged 💛'}
          </Text>
        ) : forMe ? (
          <Pressable onPress={onTake} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Ionicons name="play-circle-outline" size={16} color={colors.primary} />
            <Text style={{ color: colors.primary, fontSize: font.sizes.sm, fontWeight: '800' }}>Take it</Text>
          </Pressable>
        ) : (
          <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}>Waiting on them.</Text>
        )}
      </View>
    </View>
  );
}

/** A rich attachment inside a bubble: verse (peek + memorize), note (save), song (open). */
function AttachmentCard({
  a,
  mine,
  onSaveVerse,
  onSaveNote,
  onOpenSong,
}: {
  a: MessageAttachment;
  mine: boolean;
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

  return (
    <View style={{ backgroundColor: bg, borderRadius: radius.md, padding: spacing.sm, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name="book" size={13} color={fg} />
        {a.ref ? (
          mine ? <Text style={{ color: fg, fontWeight: '800', fontSize: font.sizes.sm }}>{a.ref}</Text> : <PeekableRef reference={a.ref} tone="plain" />
        ) : null}
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
