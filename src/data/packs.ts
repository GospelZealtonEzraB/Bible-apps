export interface StarterPack {
  id: string;
  name: string;
  emoji: string;
  description: string;
  references: string[];
}

/**
 * Curated topical verse collections so the app is useful in the first 30
 * seconds. Every reference here is covered by the offline fixtures so a pack
 * can be added without a network connection.
 */
export const STARTER_PACKS: StarterPack[] = [
  {
    id: 'anxiety-peace',
    name: 'Anxiety & Peace',
    emoji: '🕊️',
    description: 'Steady your heart when worry creeps in.',
    references: [
      'Philippians 4:6-7',
      'Matthew 6:34',
      'Isaiah 41:10',
      'John 14:27',
      '1 Peter 5:7',
      'Psalm 34:4',
    ],
  },
  {
    id: 'foundations',
    name: 'Foundations of Faith',
    emoji: '✝️',
    description: 'Cornerstone verses every believer should know.',
    references: [
      'John 3:16',
      'Ephesians 2:8-9',
      'Romans 10:9',
      'Hebrews 11:1',
      'John 1:1',
      'Romans 3:23',
    ],
  },
  {
    id: 'comfort',
    name: 'Psalms of Comfort',
    emoji: '🌊',
    description: 'Ancient words of refuge for hard days.',
    references: [
      'Psalm 23:1',
      'Psalm 46:1',
      'Psalm 121:1-2',
      'Psalm 34:18',
      'Psalm 27:1',
    ],
  },
  {
    id: 'romans-road',
    name: 'The Romans Road',
    emoji: '🛤️',
    description: 'The gospel, traced through Romans.',
    references: [
      'Romans 3:23',
      'Romans 6:23',
      'Romans 5:8',
      'Romans 10:9',
      'Romans 10:13',
    ],
  },
  {
    id: 'strength',
    name: 'Strength & Courage',
    emoji: '🦁',
    description: 'Fuel for when you need to stand firm.',
    references: [
      'Joshua 1:9',
      'Philippians 4:13',
      'Isaiah 40:31',
      '2 Timothy 1:7',
      'Psalm 28:7',
    ],
  },
];

/** A rotating "verse of the day" pool (all covered by fixtures). */
export const VERSE_OF_THE_DAY_POOL: string[] = [
  'Psalm 119:11',
  'Proverbs 3:5-6',
  'Jeremiah 29:11',
  'Philippians 4:13',
  'Isaiah 41:10',
  'John 3:16',
  'Psalm 23:1',
];
