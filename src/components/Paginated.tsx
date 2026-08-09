import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui';
import { spacing } from '@/theme';

/**
 * Incremental "show more" paging for lists rendered with .map inside a
 * ScrollView (where a virtualized FlatList would nest badly). Keeps the initial
 * render small and scannable; the user reveals more on demand. Pass a
 * `resetKey` (e.g. the active filter/query) to collapse back to the first page
 * when the underlying list changes.
 */
export function usePaged<T>(items: T[], pageSize = 20, resetKey?: unknown) {
  const [count, setCount] = useState(pageSize);
  useEffect(() => { setCount(pageSize); }, [resetKey, pageSize]);
  return {
    shown: items.slice(0, count),
    hasMore: items.length > count,
    remaining: Math.max(0, items.length - count),
    showMore: () => setCount((c) => c + pageSize),
  };
}

/** A "Show N more" button; renders nothing when there's nothing left. */
export function PageMore({ remaining, step, onPress, noun = 'more' }: { remaining: number; step: number; onPress: () => void; noun?: string }) {
  if (remaining <= 0) return null;
  const n = Math.min(remaining, step);
  return (
    <View style={{ marginTop: spacing.sm }}>
      <Button title={`Show ${n} ${noun}`} variant="ghost" small onPress={onPress} />
    </View>
  );
}
