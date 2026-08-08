import {
  DAILY_QUESTS,
  questCount,
  questDone,
  allQuestsDone,
  questsCompletedCount,
} from '@/quests';
import type { DailyProgress } from '@/types';

const daily = (over: Partial<DailyProgress> = {}): DailyProgress => ({
  day: '2024-01-01',
  reviews: 0,
  drills: 0,
  perfect: 0,
  added: 0,
  questBonusClaimed: false,
  ...over,
});

describe('quests', () => {
  const review = DAILY_QUESTS.find((q) => q.id === 'review')!;

  test('questCount is capped at the goal', () => {
    expect(questCount(review, daily({ reviews: 1 }))).toBe(1);
    expect(questCount(review, daily({ reviews: 99 }))).toBe(review.goal);
  });

  test('questDone flips at the goal', () => {
    expect(questDone(review, daily({ reviews: review.goal - 1 }))).toBe(false);
    expect(questDone(review, daily({ reviews: review.goal }))).toBe(true);
  });

  test('allQuestsDone requires every quest met', () => {
    const partial = daily({ reviews: 3, drills: 2 }); // sharp (perfect) still 0
    expect(allQuestsDone(partial)).toBe(false);
    expect(questsCompletedCount(partial)).toBe(2);

    const full = daily({ reviews: 3, drills: 2, perfect: 1 });
    expect(allQuestsDone(full)).toBe(true);
    expect(questsCompletedCount(full)).toBe(DAILY_QUESTS.length);
  });
});
