import React from 'react';
import { Text, StyleProp, TextStyle } from 'react-native';
import { useTheme, font } from '@/theme';
import { parseInline } from '@/utils/blocks';
import { useVersePeek } from '@/components/PeekableRef';

/**
 * Read-mode renderer for a block's text: lightweight inline marks (**bold**,
 * *italic*) plus tappable, peekable Scripture references. Used by the block
 * editor's non-editing blocks, doc previews, and the shared view. (RefText is the
 * older refs-only variant; RichText adds mark formatting on top.)
 */
export function RichText({
  text,
  style,
  refColor,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  refColor?: string;
}) {
  const { colors } = useTheme();
  const openPeek = useVersePeek();
  const segs = parseInline(text);

  return (
    <Text style={[{ color: colors.text, fontSize: font.sizes.md, lineHeight: 24 }, style]}>
      {segs.map((s, i) => {
        if (s.t === 'ref') {
          return (
            <Text
              key={i}
              onPress={() => openPeek(s.ref)}
              style={{ color: refColor ?? colors.primary, fontWeight: '700', textDecorationLine: 'underline' }}
            >
              {s.v}
            </Text>
          );
        }
        if (s.t === 'bold') return <Text key={i} style={{ fontWeight: '800' }}>{s.v}</Text>;
        if (s.t === 'italic') return <Text key={i} style={{ fontStyle: 'italic' }}>{s.v}</Text>;
        return <Text key={i}>{s.v}</Text>;
      })}
    </Text>
  );
}
