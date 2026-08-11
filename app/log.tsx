import React, { useMemo } from 'react';
import { View, Text } from 'react-native';

import { Screen, Header } from '@/components/layout';
import { Card, EmptyState, SectionTitle } from '@/components/ui';
import { LogEntryRow } from '@/components/LogEntryRow';
import { useTheme, spacing, font } from '@/theme';
import { useLog } from '@/store/useStore';
import { entriesForDay, logDays } from '@/utils/log';
import { prettyDay } from '@/utils/date';

/**
 * The whole log, day by day — the record of a walk. Nothing is scored or
 * ranked here; it is simply what happened, newest day first.
 */
export default function LogScreen() {
  const { colors } = useTheme();
  const log = useLog();
  const days = useMemo(() => logDays(log), [log]);
  const total = Object.keys(log).length;

  return (
    <Screen>
      <Header
        title="My log"
        subtitle={total ? `${total} entr${total === 1 ? 'y' : 'ies'} across ${days.length} day${days.length === 1 ? '' : 's'}` : undefined}
        back
      />

      {days.length === 0 ? (
        <Card>
          <EmptyState
            emoji="🕯️"
            title="Your log is empty"
            subtitle="Anything you read, sing, write, or memorize can be added to the day with one tap."
          />
        </Card>
      ) : (
        days.map((day) => (
          <View key={day}>
            <SectionTitle>{prettyDay(day)}</SectionTitle>
            <View style={{ gap: spacing.sm }}>
              {entriesForDay(log, day).map((e) => (
                <LogEntryRow key={e.id} entry={e} />
              ))}
            </View>
          </View>
        ))
      )}

      {days.length > 0 ? (
        <Text style={{ color: colors.textFaint, fontSize: font.sizes.xs, textAlign: 'center' }}>
          Your partner sees these unless you long-press an entry and keep it private.
        </Text>
      ) : null}
    </Screen>
  );
}
