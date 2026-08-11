import React from 'react';
import { Redirect } from 'expo-router';

import { useCircleList } from '@/store/useStore';
import PartnerSetupScreen from '@/components/PartnerSetup';

/**
 * The Chat tab. With a covenant partner it *is* the conversation — the one
 * place you talk, pray, and share what you're reading. Without one it's the
 * invite screen, and nothing else.
 */
export default function ChatTab() {
  const circles = useCircleList();
  const code = circles[0]?.meta.code;
  return code ? <Redirect href={`/circle/${code}/discussion`} /> : <PartnerSetupScreen />;
}
