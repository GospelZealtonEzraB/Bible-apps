import { Redirect } from 'expo-router';

/** The hymnal is now part of the one Songbook. Kept so old links still land. */
export default function HymnsRedirect() {
  return <Redirect href="/songbook" />;
}
