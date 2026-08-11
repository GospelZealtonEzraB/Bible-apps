import { Redirect, useLocalSearchParams } from 'expo-router';

/** A hymn is just a song in the one Songbook now. */
export default function HymnRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={typeof id === 'string' ? `/songbook/${id}` : '/songbook'} />;
}
