import {
  makeBlock,
  emptyDoc,
  detectShortcut,
  setBlockType,
  toggleChecked,
  insertAfter,
  removeBlock,
  moveBlock,
  splitBlock,
  mergeWithPrevious,
  docToMarkdown,
  markdownToBlocks,
  docPlainText,
  docPreview,
  extractRefs,
  docIsEmpty,
  parseInline,
} from '@/utils/blocks';
import type { Block, Doc } from '@/types';

function doc(blocks: Block[], extra: Partial<Doc> = {}): Doc {
  return { id: 'd1', type: 'note', title: '', blocks, tags: [], refs: [], createdAt: 0, updatedAt: 0, ...extra };
}

describe('block shortcuts', () => {
  test('detects heading/list/todo/quote/callout/toggle prefixes', () => {
    expect(detectShortcut('# ')).toEqual({ type: 'h1', text: '' });
    expect(detectShortcut('## Title')).toEqual({ type: 'h2', text: 'Title' });
    expect(detectShortcut('- item')).toEqual({ type: 'bulleted', text: 'item' });
    expect(detectShortcut('1. first')).toEqual({ type: 'numbered', text: 'first' });
    expect(detectShortcut('[] task')).toEqual({ type: 'todo', text: 'task' });
    expect(detectShortcut('> quoted')).toEqual({ type: 'quote', text: 'quoted' });
    expect(detectShortcut('| note')).toEqual({ type: 'callout', text: 'note' });
    expect(detectShortcut('>> more')).toEqual({ type: 'toggle', text: 'more' });
  });
  test('divider and non-matches', () => {
    expect(detectShortcut('---')).toEqual({ type: 'divider', text: '' });
    expect(detectShortcut('plain text')).toBeNull();
    expect(detectShortcut('#nospace')).toBeNull();
  });
});

describe('structural ops', () => {
  const b = (id: string, text = '', type: any = 'paragraph'): Block => ({ id, type, text });

  test('insertAfter / removeBlock / moveBlock', () => {
    let blocks = [b('1', 'a'), b('2', 'b')];
    blocks = insertAfter(blocks, '1', b('x', 'mid'));
    expect(blocks.map((x) => x.id)).toEqual(['1', 'x', '2']);
    blocks = moveBlock(blocks, 'x', 1);
    expect(blocks.map((x) => x.id)).toEqual(['1', '2', 'x']);
    blocks = removeBlock(blocks, '2');
    expect(blocks.map((x) => x.id)).toEqual(['1', 'x']);
  });

  test('removeBlock never empties the doc', () => {
    const blocks = removeBlock([b('1', 'only', 'h1')], '1');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('');
    expect(blocks[0].type).toBe('paragraph');
  });

  test('toggleChecked / setBlockType', () => {
    let blocks = [b('1', 'task', 'todo')];
    blocks = toggleChecked(blocks, '1');
    expect(blocks[0].checked).toBe(true);
    blocks = setBlockType(blocks, '1', 'quote');
    expect(blocks[0].type).toBe('quote');
  });
});

describe('split & merge', () => {
  const b = (id: string, text: string, type: any = 'paragraph'): Block => ({ id, type, text });

  test('splitBlock divides text and focuses the new block', () => {
    const { blocks, focusId } = splitBlock([b('1', 'HelloWorld')], '1', 5);
    expect(blocks[0].text).toBe('Hello');
    expect(blocks[1].text).toBe('World');
    expect(focusId).toBe(blocks[1].id);
  });

  test('a list item carries its type on split', () => {
    const { blocks } = splitBlock([b('1', 'onetwo', 'bulleted')], '1', 3);
    expect(blocks[1].type).toBe('bulleted');
  });

  test('Enter on an empty list item exits the list', () => {
    const { blocks, focusId } = splitBlock([b('1', '', 'bulleted')], '1', 0);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].type).toBe('paragraph');
    expect(focusId).toBe('1');
  });

  test('mergeWithPrevious joins into the previous block', () => {
    const { blocks, focusId, caret } = mergeWithPrevious([b('1', 'Hello'), b('2', 'World')], '2');
    expect(blocks).toHaveLength(1);
    expect(blocks[0].text).toBe('HelloWorld');
    expect(focusId).toBe('1');
    expect(caret).toBe(5);
  });

  test('merging the first styled block demotes it to paragraph', () => {
    const { blocks } = mergeWithPrevious([b('1', 'Title', 'h1')], '1');
    expect(blocks[0].type).toBe('paragraph');
  });
});

describe('markdown serialization', () => {
  test('round-trips the core block types', () => {
    const md = [
      '# Big',
      '## Small',
      '- one',
      '- two',
      '1. first',
      '2. second',
      '- [x] done',
      '- [ ] pending',
      '> a quote',
      'a paragraph',
      '---',
    ].join('\n');
    const blocks = markdownToBlocks(md);
    const types = blocks.map((b) => b.type);
    expect(types).toEqual(['h1', 'h2', 'bulleted', 'bulleted', 'numbered', 'numbered', 'todo', 'todo', 'quote', 'paragraph', 'divider']);
    expect(blocks[6].checked).toBe(true);
    expect(blocks[7].checked).toBe(false);
  });

  test('numbered list renumbers on export', () => {
    const d = doc([makeBlock('numbered', 'a'), makeBlock('numbered', 'b'), makeBlock('numbered', 'c')]);
    const md = docToMarkdown(d);
    expect(md).toContain('1. a');
    expect(md).toContain('2. b');
    expect(md).toContain('3. c');
  });

  test('docToMarkdown includes the title as H1', () => {
    const d = doc([makeBlock('paragraph', 'body')], { title: 'My Note' });
    expect(docToMarkdown(d)).toBe('# My Note\n\nbody');
  });
});

describe('derivations', () => {
  test('extractRefs collects linked references + anchor', () => {
    const d = doc([makeBlock('paragraph', 'See John 3:16 and Romans 8:28.')], { anchorRef: 'Psalm 23:1' });
    const refs = extractRefs(d);
    expect(refs).toContain('John 3:16');
    expect(refs).toContain('Romans 8:28');
    expect(refs).toContain('Psalm 23:1');
  });

  test('docPlainText / docPreview', () => {
    const d = doc([makeBlock('h1', 'Grace'), makeBlock('paragraph', 'Amazing grace how sweet')], { title: 'T' });
    expect(docPlainText(d)).toBe('T Grace Amazing grace how sweet');
    expect(docPreview(d)).toBe('Grace');
  });

  test('docIsEmpty', () => {
    expect(docIsEmpty(emptyDoc('note'))).toBe(true);
    expect(docIsEmpty(doc([makeBlock('paragraph', 'x')]))).toBe(false);
    expect(docIsEmpty(doc([makeBlock('paragraph', '')], { title: 'has title' }))).toBe(false);
  });
});

describe('parseInline', () => {
  test('splits bold, italic, and references', () => {
    const segs = parseInline('God is **love** and *good*; see John 3:16.');
    expect(segs).toEqual([
      { t: 'text', v: 'God is ' },
      { t: 'bold', v: 'love' },
      { t: 'text', v: ' and ' },
      { t: 'italic', v: 'good' },
      { t: 'text', v: '; see ' },
      { t: 'ref', v: 'John 3:16', ref: 'John 3:16' },
      { t: 'text', v: '.' },
    ]);
  });

  test('underscore italics and plain text', () => {
    expect(parseInline('_wait_ on Him')).toEqual([
      { t: 'italic', v: 'wait' },
      { t: 'text', v: ' on Him' },
    ]);
    expect(parseInline('nothing special')).toEqual([{ t: 'text', v: 'nothing special' }]);
  });
});
