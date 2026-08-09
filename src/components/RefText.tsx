import React, { useState } from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { useTheme, font } from '@/theme';
import { VersePeek } from './VersePeek';
import { linkifyReferences } from '@/utils/refs';

/**
 * Renders free text with inline Scripture references made tappable — tapping one
 * opens a VersePeek popover. Reused for notes, discussion, commentary. Keeps text
 * flow inline (references are colored spans, not chips).
 *
 * `refColor` sets the reference color for callers that render on a colored
 * background (e.g. a chat bubble filled with `primary` — where the default
 * `primary` reference would be invisible). References are always underlined so
 * they stay distinguishable even when their color matches the surrounding text.
 */
export function RefText({ text, style, refColor }: { text: string; style?: StyleProp<TextStyle>; refColor?: string }) {
  const { colors } = useTheme();
  const [peek, setPeek] = useState<string | null>(null);
  const segments = linkifyReferences(text);

  return (
    <>
      <Text style={[{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }, style]}>
        {segments.map((seg, i) =>
          seg.type === 'ref' ? (
            <Text key={i} onPress={() => setPeek(seg.reference)} style={{ color: refColor ?? colors.primary, fontWeight: '700', textDecorationLine: 'underline' }}>
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
