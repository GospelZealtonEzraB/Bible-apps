import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Web song search is now a section inside the one Songbook, not its own screen.
 * The `?q=` deep link is preserved so old entry points still search.
 */
export default function SongsRedirect() {
  const { q } = useLocalSearchParams<{ q: string }>();
  return <Redirect href={typeof q === 'string' && q ? `/songbook?q=${encodeURIComponent(q)}` : '/songbook'} />;
}
