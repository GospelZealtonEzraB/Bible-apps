import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Header } from '@/components/layout';
import { Card, Chip, EmptyState, SectionTitle } from '@/components/ui';
import { LogEntryRow } from '@/components/LogEntryRow';
import { VersePeek } from '@/components/VersePeek';
import { useTheme, spacing, font, radius } from '@/theme';
import { useCircle, useStore } from '@/store/useStore';
import { publicEntriesForDay, logDays } from '@/utils/log';
import { docPreview } from '@/utils/blocks';
import { prettyDay } from '@/utils/date';

type Tab = 'log' | 'shelf';

/**
 * Your partner's walk, read-only: the days they've logged, and the shelf they
 * keep — their notes, the songs they've starred, the topics they're gathering,
 * the verses they're learning. Everything they haven't marked private.
 *
 * Anything here can be adopted into your own library or notes with one tap;
 * that's how you learn from each other rather than just watch each other.
 */
export default function PartnerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; memberId: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const memberId = typeof params.memberId === 'string' ? params.memberId : '';

  const circle = useCircle(code);
  const adoptVerse = useStore((s) => s.adoptVerse);
  const adoptReflection = useStore((s) => s.adoptReflection);

  const [tab, setTab] = useState<Tab>('log');
  const [peek, setPeek] = useState<string | null>(null);

  const member = (circle?.members ?? []).find((m) => m.id === memberId);
  const theirLog = circle?.logs?.[memberId] ?? {};
  const shelf = circle?.shelves?.[memberId];
  const days = useMemo(() => logDays(theirLog), [theirLog]);

  if (!member) {
    return (
      <Screen>
        <Header title="Partner" back />
        <EmptyState emoji="👋" title="Not here yet" subtitle="Once they join, their walk shows up here." />
      </Screen>
    );
  }

  const name = member.displayName || 'Your partner';

  const takeVerse = (ref: string) => {
    adoptVerse(ref)
      .then(() => Alert.alert('Added to your library', `${ref} is now in your verses.`))
      .catch(() => {});
  };

  const takeNote = (title: string, text: string) => {
    adoptReflection(text, name);
    Alert.alert('Saved to your notes 💛', `“${title}” is yours to keep.`);
  };

  return (
    <Screen>
      <Header title={name} subtitle="Their walk, open to you" back />

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Chip label="Their log" active={tab === 'log'} onPress={() => setTab('log')} />
        <Chip label="Their shelf" active={tab === 'shelf'} onPress={() => setTab('shelf')} />
      </View>

      {tab === 'log' ? (
        days.length === 0 ? (
          <Card>
            <EmptyState
              emoji="🕯️"
              title="Nothing logged yet"
              subtitle={`When ${name} adds something to their day, you'll see it here.`}
            />
          </Card>
        ) : (
          days.map((day) => {
            const entries = publicEntriesForDay(theirLog, day);
            if (entries.length === 0) return null;
            return (
              <View key={day}>
                <SectionTitle>{prettyDay(day)}</SectionTitle>
                <View style={{ gap: spacing.sm }}>
                  {entries.map((e) => (
                    <View key={e.id} style={{ gap: 4 }}>
                      <LogEntryRow entry={e} readOnly />
                      {e.ref ? (
                        <Pressable
                          onPress={() => takeVerse(e.ref!)}
                          hitSlop={6}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingLeft: spacing.sm }}
                        >
                          <Ionicons name="add-circle-outline" size={13} color={colors.primary} />
                          <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>
                            Take this into my library
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              </View>
            );
          })
        )
      ) : (
        <>
          {/* What they're learning */}
          {(member.memorizedRefs?.length ?? 0) + (member.learningRefs?.length ?? 0) > 0 ? (
            <View>
              <SectionTitle>Verses they know</SectionTitle>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {(member.memorizedRefs ?? []).slice(0, 30).map((r) => (
                  <Chip key={r} label={r} onPress={() => setPeek(r)} />
                ))}
              </View>
              {(member.learningRefs?.length ?? 0) > 0 ? (
                <>
                  <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, fontWeight: '700', marginTop: spacing.md }}>
                    STILL LEARNING
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 }}>
                    {(member.learningRefs ?? []).slice(0, 20).map((r) => (
                      <Chip key={r} label={r} onPress={() => setPeek(r)} />
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {/* Their notes */}
          <View>
            <SectionTitle>Their notes</SectionTitle>
            {(shelf?.notes ?? []).length === 0 ? (
              <Card>
                <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>
                  Nothing shared yet — notes they mark private never appear here.
                </Text>
              </Card>
            ) : (
              <View style={{ gap: spacing.sm }}>
                {(shelf?.notes ?? []).map((d) => (
                  <Card key={d.id} style={{ gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>
                      {d.title || 'Untitled note'}
                    </Text>
                    <Text numberOfLines={4} style={{ color: colors.textMuted, fontSize: font.sizes.sm, lineHeight: 20 }}>
                      {docPreview(d, 400)}
                    </Text>
                    <Pressable
                      onPress={() => takeNote(d.title || 'Their note', docPreview(d, 2000))}
                      hitSlop={6}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' }}
                    >
                      <Ionicons name="download-outline" size={13} color={colors.primary} />
                      <Text style={{ color: colors.primary, fontSize: font.sizes.xs, fontWeight: '700' }}>Save to my notes</Text>
                    </Pressable>
                  </Card>
                ))}
              </View>
            )}
          </View>

          {/* Their songs */}
          {(shelf?.songs ?? []).length > 0 ? (
            <View>
              <SectionTitle>Songs they love</SectionTitle>
              <View style={{ gap: spacing.sm }}>
                {(shelf?.songs ?? []).map((sg) => (
                  <Card key={sg.id} onPress={() => router.push(`/songbook/${sg.id}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <Ionicons name="musical-notes" size={17} color={colors.accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.sizes.md }}>{sg.title}</Text>
                      {sg.author ? <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{sg.author}</Text> : null}
                    </View>
                    <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
                  </Card>
                ))}
              </View>
            </View>
          ) : null}

          {/* Their topics */}
          {(shelf?.topics ?? []).length > 0 ? (
            <View>
              <SectionTitle>What they're studying</SectionTitle>
              <View style={{ gap: spacing.sm }}>
                {(shelf?.topics ?? []).map((t) => (
                  <Card key={t.id} style={{ gap: 6 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{t.title}</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {t.refs.slice(0, 12).map((r) => (
                        <Chip key={r} label={r} onPress={() => setPeek(r)} />
                      ))}
                    </View>
                  </Card>
                ))}
              </View>
            </View>
          ) : null}

          {!shelf ? (
            <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center', lineHeight: 18 }}>
              Their shelf fills in once they open the app on a version that shares it.
            </Text>
          ) : null}
        </>
      )}

      <VersePeek reference={peek} onClose={() => setPeek(null)} />
    </Screen>
  );
}
