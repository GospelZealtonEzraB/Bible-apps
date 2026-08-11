import {
  coerceTeaching,
  teachingIsEmpty,
  teachingTitle,
  teachingToBlocks,
} from '../src/utils/teaching';

const full = {
  title: 'Waiting on the Lord',
  summary: 'The message walked through Isaiah 40 and the strength God gives.',
  outline: [
    { heading: 'Our weariness', points: ['Even young men fall', 'Strength runs out'] },
    { heading: 'His strength', points: ['He does not grow weary'] },
  ],
  keyPoints: ['Waiting is active trust', 'God renews what we cannot'],
  application: 'Name one place you are striving, and wait on Him there this week.',
  references: ['Isaiah 40:31', 'isa 40:28', 'Philippians 4:13'],
};

describe('coerceTeaching', () => {
  test('keeps a well-formed teaching and canonicalizes references', () => {
    const t = coerceTeaching(full);
    expect(t.title).toBe('Waiting on the Lord');
    expect(t.outline).toHaveLength(2);
    expect(t.outline[0].points).toEqual(['Even young men fall', 'Strength runs out']);
    expect(t.keyPoints).toHaveLength(2);
    expect(t.references).toEqual(['Isaiah 40:31', 'Isaiah 40:28', 'Philippians 4:13']);
  });

  test('drops hallucinated references', () => {
    const t = coerceTeaching({ ...full, references: ['Isaiah 40:31', 'Hezekiah 3:5', '2 Opinions 1:1'] });
    expect(t.references).toEqual(['Isaiah 40:31']);
  });

  test('tolerates the old {summary, references} shape from a stale Worker', () => {
    const t = coerceTeaching({ summary: 'A short blob.', references: ['John 3:16'] });
    expect(t.summary).toBe('A short blob.');
    expect(t.references).toEqual(['John 3:16']);
    expect(t.outline).toEqual([]);
    expect(t.keyPoints).toEqual([]);
    expect(teachingIsEmpty(t)).toBe(false);
  });

  test('junk in — empty teaching out, never a throw', () => {
    for (const junk of [null, undefined, 'a string', 42, [], { outline: 'nope', keyPoints: {} }]) {
      const t = coerceTeaching(junk);
      expect(teachingIsEmpty(t)).toBe(true);
      expect(t.references).toEqual([]);
    }
  });

  test('malformed outline sections are dropped, not rendered as blanks', () => {
    const t = coerceTeaching({
      outline: [{ heading: 'Real', points: ['a'] }, null, { heading: '', points: [] }, { points: [1, 'b'] }],
    });
    expect(t.outline).toEqual([
      { heading: 'Real', points: ['a'] },
      { heading: '', points: ['b'] },
    ]);
  });

  test('caps runaway output', () => {
    const t = coerceTeaching({
      keyPoints: Array.from({ length: 40 }, (_, i) => `point ${i}`),
      outline: Array.from({ length: 20 }, () => ({ heading: 'h', points: ['p'] })),
      summary: 'x'.repeat(9000),
    });
    expect(t.keyPoints).toHaveLength(8);
    expect(t.outline).toHaveLength(8);
    expect(t.summary.length).toBe(2500);
  });
});

describe('teachingTitle', () => {
  test('prefers the title, then the first sentence, then the fallback', () => {
    expect(teachingTitle(coerceTeaching(full))).toBe('Waiting on the Lord');
    expect(teachingTitle(coerceTeaching({ summary: 'First sentence here. Second one.' })))
      .toBe('First sentence here.');
    expect(teachingTitle(coerceTeaching({}), 'Sunday message')).toBe('Sunday message');
  });
});

describe('teachingToBlocks', () => {
  const blocks = teachingToBlocks(coerceTeaching(full), { source: 'https://example.com/sermon' });
  const typed = (type: string) => blocks.filter((b) => b.type === type);

  test('the summary opens the document', () => {
    expect(blocks[0]).toMatchObject({ type: 'paragraph', text: full.summary });
  });

  test('each outline section becomes a heading with bulleted points', () => {
    expect(typed('h2').map((b) => b.text)).toEqual([
      'Our weariness',
      'His strength',
      'Key points',
      'Scripture',
      'Living it out',
    ]);
    expect(typed('bulleted').map((b) => b.text)).toEqual([
      'Even young men fall',
      'Strength runs out',
      'He does not grow weary',
      'Waiting is active trust',
      'God renews what we cannot',
    ]);
  });

  test('references are listed and the application is quoted', () => {
    expect(blocks.some((b) => b.text.includes('Isaiah 40:31 · Isaiah 40:28'))).toBe(true);
    expect(typed('quote')[0].text).toBe(full.application);
  });

  test('the source and the AI caveat are called out', () => {
    const callouts = typed('callout').map((b) => b.text);
    expect(callouts[0]).toContain('https://example.com/sermon');
    expect(callouts[1]).toMatch(/weigh them/i);
  });

  test('every block has a unique id', () => {
    expect(new Set(blocks.map((b) => b.id)).size).toBe(blocks.length);
  });

  test('an empty teaching still yields an editable document', () => {
    const empty = teachingToBlocks(coerceTeaching({}));
    expect(empty.length).toBeGreaterThan(0);
  });
});
