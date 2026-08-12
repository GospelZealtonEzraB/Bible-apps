import React from 'react';
import { useLocalSearchParams } from 'expo-router';

import { Conversation } from '@/components/Conversation';

/**
 * The conversation as a standalone route — how you arrive when you tap
 * "Discuss this" on a verse or a note, so the thread opens anchored to it.
 * The Chat tab renders the same component inline instead of routing here.
 */
export default function DiscussionScreen() {
  const params = useLocalSearchParams<{ code: string; context?: string }>();
  const code = typeof params.code === 'string' ? params.code : '';
  const context =
    typeof params.context === 'string' && params.context ? decodeURIComponent(params.context) : null;

  return <Conversation code={code} context={context} showBack />;
}
