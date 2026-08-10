import React, { createContext, useCallback, useContext, useState } from 'react';
import { Pressable, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme, spacing, font, radius } from '@/theme';
import { VersePeek } from './VersePeek';

/**
 * App-wide "tap any reference to peek it" plumbing. A single VersePeek modal is
 * mounted once by `VersePeekProvider` (in `_layout.tsx`); `PeekableRef` and
 * `useVersePeek` open it from anywhere with no per-screen state. This is what
 * makes "every Scripture reference everywhere is clickable" a product law rather
 * than a per-screen chore.
 *
 * - For a *discrete* reference (a chip/label in a feed, verse list, plan item,
 *   member page), render `<PeekableRef reference="John 3:16" />`.
 * - For references *inside prose*, use `RefText` (it linkifies inline).
 */
const PeekContext = createContext<(reference: string) => void>(() => {});

/** Open the shared VersePeek for a reference from anywhere under the provider. */
export function useVersePeek(): (reference: string) => void {
  return useContext(PeekContext);
}

export function VersePeekProvider({ children }: { children: React.ReactNode }) {
  const [reference, setReference] = useState<string | null>(null);
  const open = useCallback((r: string) => setReference(r), []);
  return (
    <PeekContext.Provider value={open}>
      {children}
      <VersePeek reference={reference} onClose={() => setReference(null)} />
    </PeekContext.Provider>
  );
}

/**
 * A tappable reference chip that opens the shared VersePeek. `tone`:
 * - `'chip'` (default): a soft pill, for standalone reference lists/feeds.
 * - `'plain'`: an underlined inline-styled label, for tighter rows.
 */
export function PeekableRef({
  reference,
  label,
  tone = 'chip',
  style,
}: {
  reference: string;
  label?: string;
  tone?: 'chip' | 'plain';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const open = useVersePeek();
  if (tone === 'plain') {
    return (
      <Text
        onPress={() => open(reference)}
        style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.sm, textDecorationLine: 'underline' }}
      >
        {label ?? reference}
      </Text>
    );
  }
  return (
    <Pressable
      onPress={() => open(reference)}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 5,
          paddingHorizontal: spacing.sm,
          borderRadius: radius.pill,
          backgroundColor: colors.primarySoft,
        },
        style,
      ]}
    >
      <Text style={{ color: colors.primary, fontWeight: '700', fontSize: font.sizes.xs }}>{label ?? reference}</Text>
    </Pressable>
  );
}
