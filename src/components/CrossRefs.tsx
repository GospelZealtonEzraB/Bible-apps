import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { Chip, SectionTitle } from '@/components/ui';
import { VersePeek } from '@/components/VersePeek';
import { useTheme, spacing, font } from '@/theme';
import { getCrossRefs } from '@/data/crossRefs';

/**
 * Cross-references for a verse — the top related passages (Treasury of Scripture
 * Knowledge via openbible.info, CC-BY). Tap a reference to peek it. Offline.
 */
export function CrossRefs({ reference }: { reference: string }) {
  const { colors } = useTheme();
  const [peek, setPeek] = useState<string | null>(null);
  const refs = getCrossRefs(reference);

  if (refs.length === 0) return null;

  return (
    <View>
      <SectionTitle>Cross-references</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {refs.map((r) => (
          <Chip key={r} label={r} onPress={() => setPeek(r)} />
        ))}
      </View>
      <Text style={{ color: colors.textFaint, fontSize: 10, marginTop: spacing.sm }}>
        Cross-reference data: openbible.info (CC BY)
      </Text>
      <VersePeek reference={peek} onClose={() => setPeek(null)} />
    </View>
  );
}
