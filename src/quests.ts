/**
 * Daily quests: small, finishable goals that reset each day and award a bonus
 * when all are complete. Pure logic; the per-day counters live on Stats.daily.
 */
import type { DailyProgress } from '@/types';

export type QuestMetric = 'reviews' | 'drills' | 'perfect';

export interface Quest {
  id: string;
  emoji: string;
  name: string;
  goal: number;
  metric: QuestMetric;
}

export const DAILY_QUESTS: Quest[] = [
  { id: 'review', emoji: '🔁', name: 'Review 3 verses', goal: 3, metric: 'reviews' },
  { id: 'practice', emoji: '✍️', name: 'Complete 2 drills', goal: 2, metric: 'drills' },
  { id: 'sharp', emoji: '🎯', name: 'Score 90%+ on a drill', goal: 1, metric: 'perfect' },
];

/** XP bonus for finishing every daily quest. */
export const QUEST_BONUS_XP = 25;

export function questCount(quest: Quest, daily: DailyProgress): number {
  return Math.min(quest.goal, daily[quest.metric]);
}

export function questDone(quest: Quest, daily: DailyProgress): boolean {
  return daily[quest.metric] >= quest.goal;
}

export function allQuestsDone(daily: DailyProgress): boolean {
  return DAILY_QUESTS.every((q) => questDone(q, daily));
}

export function questsCompletedCount(daily: DailyProgress): number {
  return DAILY_QUESTS.filter((q) => questDone(q, daily)).length;
}
