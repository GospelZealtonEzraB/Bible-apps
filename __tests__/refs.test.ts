import { linkifyReferences, hasReference } from '@/utils/refs';

function refs(text: string) {
  return linkifyReferences(text).filter((s) => s.type === 'ref') as { reference: string }[];
}

describe('linkifyReferences', () => {
  test('detects a single verse and canonicalizes it', () => {
    const segs = linkifyReferences('See John 3:16 today');
    expect(segs).toEqual([
      { type: 'text', value: 'See ' },
      { type: 'ref', value: 'John 3:16', reference: 'John 3:16' },
      { type: 'text', value: ' today' },
    ]);
  });

  test('detects multiple references and a range', () => {
    const r = refs('Compare Romans 12:1-2 with 1 John 1:9.');
    expect(r.map((x) => x.reference)).toEqual(['Romans 12:1-2', '1 John 1:9']);
  });

  test('whole-chapter and abbreviations', () => {
    expect(refs('Read Psalm 23 slowly').map((x) => x.reference)).toEqual(['Psalms 23']);
    expect(refs('Isa 40:31 renews').map((x) => x.reference)).toEqual(['Isaiah 40:31']);
  });

  test('canonicalizes an abbreviation with a verse', () => {
    expect(refs('Jn 3:16').map((x) => x.reference)).toEqual(['John 3:16']);
  });

  test('avoids false positives from short words without a verse', () => {
    // "am" is the Amos abbreviation; must NOT match in prose without chapter:verse.
    expect(hasReference('I am 3 years old')).toBe(false);
    expect(refs('Amos 3:1 declares')).toHaveLength(1); // full name still works
  });

  test('plain text with no references', () => {
    expect(linkifyReferences('Just a thought.')).toEqual([{ type: 'text', value: 'Just a thought.' }]);
    expect(hasReference('Just a thought.')).toBe(false);
  });
});
