import React, { useState } from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { useTheme, font } from '@/theme';
import { VersePeek } from './VersePeek';
import { linkifyReferences } from '@/utils/refs';

/**
 * Renders free text with inline Scripture references made tappable — tapping one
 * opens a VersePeek popover. Reused for notes (now) and discussion/commentary
 * (later). Keeps text flow inline (references are colored spans, not chips).
 */
export function RefText({ text, style }: { text: string; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  const [peek, setPeek] = useState<string | null>(null);
  const segments = linkifyReferences(text);

  return (
    <>
      <Text style={[{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }, style]}>
        {segments.map((seg, i) =>
          seg.type === 'ref' ? (
            <Text key={i} onPress={() => setPeek(seg.reference)} style={{ color: colors.primary, fontWeight: '700' }}>
              {seg.value}
            </Text>
          ) : (
            <Text key={i}>{seg.value}</Text>
          ),
        )}
      </Text>
      <VersePeek reference={peek} onClose={() => setPeek(null)} />
    </>
  );
}
