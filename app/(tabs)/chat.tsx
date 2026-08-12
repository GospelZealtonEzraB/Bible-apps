import React from 'react';

import { useCircleList } from '@/store/useStore';
import { Conversation } from '@/components/Conversation';
import PartnerSetupScreen from '@/components/PartnerSetup';

/**
 * The Chat tab. With a covenant partner it *is* the conversation — the one
 * place you talk, pray, and share what you're reading. Without one it's the
 * invite screen, and nothing else.
 *
 * The thread renders in place rather than redirecting to the standalone route:
 * the tab bar stays visible while you chat (as in any messaging app), and a
 * tab must never `replace` itself with a route that lives outside the tab
 * navigator — that unmounts the navigator from inside its own focus effect.
 */
export default function ChatTab() {
  const circles = useCircleList();
  const code = circles[0]?.meta?.code;
  return code ? <Conversation code={code} /> : <PartnerSetupScreen />;
}
