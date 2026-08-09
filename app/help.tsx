import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';

import { Screen, Header } from '@/components/layout';
import { Card } from '@/components/ui';
import { Ember } from '@/components/Ember';
import { HelpSheet } from '@/components/EmberGuide';
import { useTheme, spacing, font } from '@/theme';
import { HELP, HELP_ORDER } from '@/data/help';

/**
 * Help & guides — every feature's Ember explainer in one place. Tapping a row
 * opens the same HelpSheet used by the per-screen ⓘ buttons.
 */
export default function HelpHubScreen() {
  const { colors } = useTheme();
  const [topic, setTopic] = useState<string | null>(null);

  return (
    <Screen>
      <Header title="Help & guides" subtitle="How every part of Versed works" back />

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ember mood="waving" size={56} />
        <Text style={{ flex: 1, color: colors.text, fontSize: font.sizes.sm, fontFamily: font.serif, fontStyle: 'italic', lineHeight: 21 }}>
          Tap anything below and I’ll explain it — what it’s for, an example, and a few tips.
        </Text>
      </Card>

      <View style={{ gap: spacing.sm }}>
        {HELP_ORDER.filter((key) => HELP[key]).map((key) => {
          const h = HELP[key];
          return (
            <Card key={key} onPress={() => setTopic(key)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ember mood={h.mood ?? 'content'} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: font.sizes.md }}>{h.title}</Text>
                <Text numberOfLines={1} style={{ color: colors.textFaint, fontSize: font.sizes.xs }}>{h.tip}</Text>
              </View>
              <Text style={{ color: colors.textFaint, fontSize: font.sizes.sm }}>ⓘ</Text>
            </Card>
          );
        })}
      </View>

      <HelpSheet topic={topic ?? ''} visible={!!topic} onClose={() => setTopic(null)} />
    </Screen>
  );
}
