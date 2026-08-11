import { Redirect, useLocalSearchParams } from 'expo-router';

/** "Songs from this verse" moved under the Songbook. */
export default function HymnsForVerseRedirect() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  return <Redirect href={typeof ref === 'string' ? `/songbook/verse/${ref}` : '/songbook'} />;
}
