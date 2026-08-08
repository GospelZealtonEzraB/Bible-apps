import {
  levelInfo,
  xpForPractice,
  xpForReview,
  masteryTier,
  newlyEarnedBadges,
  type BadgeContext,
} from '@/gamification';

const emptyCtx: BadgeContext = {
  memorizedCount: 0,
  verseCount: 0,
  bestStreak: 0,
  perfectRecitations: 0,
  earlyReviews: 0,
};

describe('levelInfo', () => {
  test('level 1 at 0 XP', () => {
    const l = levelInfo(0);
    expect(l.level).toBe(1);
    expect(l.inLevel).toBe(0);
    expect(l.progress).toBe(0);
  });

  test('crosses to level 2 at 100 XP and tracks progress', () => {
    expect(levelInfo(99).level).toBe(1);
    const l = levelInfo(150);
    expect(l.level).toBe(2);
    expect(l.inLevel).toBe(50);
    expect(l.progress).toBe(50);
  });
});

describe('xp awards', () => {
  test('practice XP scales with accuracy and rewards perfection', () => {
    expect(xpForPractice(0)).toBe(5);
    expect(xpForPractice(50)).toBe(10);
    expect(xpForPractice(100)).toBe(20);
  });

  test('review XP rises with recall quality', () => {
    expect(xpForReview('again')).toBeLessThan(xpForReview('hard'));
    expect(xpForReview('hard')).toBeLessThan(xpForReview('good'));
    expect(xpForReview('good')).toBeLessThan(xpForReview('easy'));
  });
});

describe('masteryTier', () => {
  test('maps score to the right tier', () => {
    expect(masteryTier(0).key).toBe('seed');
    expect(masteryTier(30).key).toBe('bronze');
    expect(masteryTier(70).key).toBe('silver');
    expect(masteryTier(95).key).toBe('gold');
  });
});

describe('newlyEarnedBadges', () => {
  test('awards first-seed on first memorized verse', () => {
    const ids = newlyEarnedBadges({ ...emptyCtx, memorizedCount: 1 }, []);
    expect(ids).toContain('first-seed');
  });

  test('does not re-award an already-earned badge', () => {
    const ids = newlyEarnedBadges({ ...emptyCtx, memorizedCount: 1 }, ['first-seed']);
    expect(ids).not.toContain('first-seed');
  });

  test('kindling needs a 7-day best streak; scholar needs 10 memorized', () => {
    expect(newlyEarnedBadges({ ...emptyCtx, bestStreak: 6 }, [])).not.toContain('kindling');
    expect(newlyEarnedBadges({ ...emptyCtx, bestStreak: 7 }, [])).toContain('kindling');
    expect(newlyEarnedBadges({ ...emptyCtx, memorizedCount: 10 }, [])).toContain('scholar');
  });
});
