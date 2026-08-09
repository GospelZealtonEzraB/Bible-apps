import {
  tokenize,
  toFirstLetters,
  diffWords,
  hiddenIndicesForLevel,
  pickBlankIndices,
  normalizeWord,
} from '@/drills/helpers';

describe('tokenize', () => {
  test('splits words and preserves punctuation', () => {
    const t = tokenize('In the beginning, God created.');
    expect(t.map((x) => x.raw)).toEqual([
      'In',
      'the',
      'beginning,',
      'God',
      'created.',
    ]);
    expect(t.every((x) => x.isWord)).toBe(true);
    expect(t[2].word).toBe('beginning');
  });

  test('collapses extra whitespace', () => {
    expect(tokenize('  a   b \n c ').map((x) => x.raw)).toEqual(['a', 'b', 'c']);
  });

  test('treats Tamil script as words (so drills work)', () => {
    // "God is love" in Tamil.
    const t = tokenize('தேவன் அன்பாயிருக்கிறார்');
    expect(t).toHaveLength(2);
    expect(t.every((x) => x.isWord)).toBe(true);
    expect(t[0].word.length).toBeGreaterThan(0);
    expect(toFirstLetters('தேவன் அன்பு')).not.toBe('');
  });
});

describe('toFirstLetters', () => {
  test('reduces each word to its first letter, keeping punctuation', () => {
    expect(toFirstLetters('In the beginning God created the heavens')).toBe(
      'I t b G c t h',
    );
    expect(toFirstLetters('Trust in Yahweh, with all your heart.')).toBe(
      'T i Y, w a y h.',
    );
  });
});

describe('diffWords', () => {
  test('perfect match scores 100', () => {
    const r = diffWords('God is love', 'God is love');
    expect(r.accuracy).toBe(100);
    expect(r.correct).toBe(3);
    expect(r.diffs.every((d) => d.verdict === 'correct')).toBe(true);
  });

  test('is case and punctuation insensitive', () => {
    const r = diffWords('God is love.', 'god IS Love');
    expect(r.accuracy).toBe(100);
  });

  test('flags wrong, missing and extra words', () => {
    const r = diffWords('God is love', 'God was love indeed');
    const verdicts = r.diffs.map((d) => d.verdict);
    expect(verdicts).toContain('wrong'); // is -> was
    expect(verdicts).toContain('extra'); // indeed
    expect(r.correct).toBe(2);
    expect(r.total).toBe(3);
  });

  test('counts missing words when attempt is short', () => {
    const r = diffWords('a b c d', 'a b');
    expect(r.diffs.filter((d) => d.verdict === 'missing').length).toBe(2);
    expect(r.accuracy).toBe(50);
  });

  test('empty expected yields zero accuracy without dividing by zero', () => {
    expect(diffWords('', 'anything').accuracy).toBe(0);
  });
});

describe('hiddenIndicesForLevel', () => {
  const tokens = tokenize('For God so loved the world that he gave');

  test('level 0 hides nothing', () => {
    expect(hiddenIndicesForLevel(tokens, 0, 5).size).toBe(0);
  });

  test('max level hides every word token', () => {
    const hidden = hiddenIndicesForLevel(tokens, 5, 5);
    expect(hidden.size).toBe(tokens.filter((t) => t.isWord).length);
  });

  test('hidden count grows monotonically with level', () => {
    let prev = -1;
    for (let lvl = 0; lvl <= 5; lvl++) {
      const size = hiddenIndicesForLevel(tokens, lvl, 5).size;
      expect(size).toBeGreaterThanOrEqual(prev);
      prev = size;
    }
  });
});

describe('pickBlankIndices', () => {
  test('picks a stable, sorted subset of real words', () => {
    const tokens = tokenize('For God so loved the world that he gave his Son');
    const a = pickBlankIndices(tokens, 0.35);
    const b = pickBlankIndices(tokens, 0.35);
    expect(a).toEqual(b); // deterministic
    expect(a).toEqual([...a].sort((x, y) => x - y)); // sorted
    expect(a.length).toBeGreaterThan(0);
    for (const i of a) {
      expect(tokens[i].word.length).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('normalizeWord', () => {
  test('lowercases and strips surrounding punctuation', () => {
    expect(normalizeWord('“Love,”')).toBe('love');
    expect(normalizeWord("don't")).toBe("don't");
  });
});

import { pickDistractors } from '@/drills/helpers';

describe('pickDistractors', () => {
  test('excludes the correct answer and de-duplicates', () => {
    const pool = ['John 3:16', 'Romans 8:28', 'romans 8:28', 'Psalms 23:1'];
    const d = pickDistractors('John 3:16', pool, 3);
    expect(d).toEqual(['Romans 8:28', 'Psalms 23:1']);
    expect(d).not.toContain('John 3:16');
  });

  test('caps at n', () => {
    expect(pickDistractors('A 1:1', ['B 1:1', 'C 1:1', 'D 1:1', 'E 1:1'], 3)).toHaveLength(3);
  });
});
