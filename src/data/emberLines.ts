/**
 * Ember's voice — categorized, rotating lines so the mascot doesn't repeat.
 *
 * Personality: an encouraging coach who's playful about streaks, drills, and
 * showing up — but hushed and reverent about the Word, prayer, and study.
 * Never tease or joke about Scripture itself.
 *
 * `pick(category, seed)` is deterministic-by-seed so it's unit-testable and
 * stable within a render. Pass a stable seed (e.g. day-of-year, a streak
 * count, or a verse index) to rotate lines without flicker.
 */

export type EmberCategory =
  | 'greeting' // warm hello, onboarding / first open of the day
  | 'streakNudge' // playful "keep it alive" (never about the Word)
  | 'celebrate' // a win — memorized, quest, badge
  | 'study' // settling in to study a passage (reverent-curious)
  | 'prayerReverent' // prayer moments — hushed, dignified
  | 'partnerActive' // a circle partner just did something
  | 'allCaughtUp' // reviews done, nothing due
  | 'encourage'; // gentle pick-me-up when behind

const LINES: Record<EmberCategory, string[]> = {
  greeting: [
    'Hey, you came back — let’s go.',
    'Good to see you. Ready to hide a little more of His Word away?',
    'Welcome back, friend.',
    'There you are! Let’s pick up where we left off.',
  ],
  streakNudge: [
    'Don’t leave me hanging — keep that streak alive!',
    'One little review and today counts. I believe in you.',
    'Your streak’s watching. No pressure… okay, a little pressure.',
    'Two minutes now beats starting over tomorrow.',
  ],
  celebrate: [
    'That one’s yours now. Beautifully done.',
    'Look at you go! Another verse in your heart.',
    'Yes! I’m so proud of you.',
    'Locked in. That’s the good stuff.',
  ],
  study: [
    'Let’s dig in — there’s so much here.',
    'Setting the scene… who’s speaking, and to whom?',
    'Slow down and savor this one with me.',
    'Every passage has a story around it. Let’s find it.',
  ],
  prayerReverent: [
    'Let’s bring this to Him together.',
    'He’s listening. Take your time.',
    'Carry it to the One who cares.',
    'Whatever it is — lay it down here.',
  ],
  partnerActive: [
    'Your circle’s been busy — go cheer them on!',
    'Someone’s growing alongside you. Isn’t that something?',
    'They showed up too. You’re not doing this alone.',
    'A little encouragement goes a long way — send some.',
  ],
  allCaughtUp: [
    'All caught up. You’re on fire.',
    'Nothing due — you’re ahead of the game.',
    'Clean slate. Rest well; I’ll keep watch.',
    'Reviews done. That’s faithfulness, right there.',
  ],
  encourage: [
    'A few verses slipped — no shame, let’s catch them up together.',
    'Right where you are is a fine place to begin again.',
    'Small steps still move you forward. Let’s take one.',
    'Grace covers the gaps. Ready when you are.',
  ],
};

/** Pick a line from a category, rotating deterministically by `seed`. */
export function pickEmberLine(category: EmberCategory, seed = 0): string {
  const pool = LINES[category];
  if (!pool || pool.length === 0) return '';
  const idx = Math.abs(Math.trunc(seed)) % pool.length;
  return pool[idx];
}

/** All lines for a category (useful for tests / previews). */
export function emberLines(category: EmberCategory): readonly string[] {
  return LINES[category];
}
