/**
 * Pure operations for the block-document model (the Notes/writing engine).
 * No store or UI imports so it's fully unit-testable. The editor and store wrap
 * these; nothing here reaches into React or persistence.
 *
 * Design notes:
 * - A Doc is an ordered list of Blocks. Blocks are flat (toggle keeps its body
 *   in `detail` rather than nesting children — keeps the editor tractable).
 * - `text` is plain; two render layers sit on top: inline Scripture refs
 *   (linkifyReferences) and lightweight markdown marks (**bold**, *italic*).
 * - Markdown is the export/interchange format, so serialize/parse are lossless
 *   for the block types we support.
 */
import type { Block, BlockType, Doc, DocType } from '@/types';
import { linkifyReferences } from '@/utils/refs';

let __seq = 0;
/** A unique-ish block/doc id. Not crypto; just stable within a device. */
export function genId(prefix: string): string {
  __seq = (__seq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${__seq.toString(36)}`;
}

const DOC_TYPES: DocType[] = ['note', 'study', 'sermon'];

/**
 * Coerce any stored doc type to a current one. Documents saved before the
 * simplification carry retired types ('journal', 'verse', 'topic', 'article');
 * they are all just notes now. Used on hydration, so it must never throw.
 */
export function normalizeDocType(type: unknown): DocType {
  return DOC_TYPES.includes(type as DocType) ? (type as DocType) : 'note';
}

export function makeBlock(type: BlockType = 'paragraph', text = ''): Block {
  return { id: genId('b'), type, text };
}

/** A fresh, empty document of a given type with one paragraph to type into. */
export function emptyDoc(type: DocType, opts: Partial<Doc> = {}): Doc {
  const now = Date.now();
  return {
    id: genId('d'),
    type,
    title: '',
    blocks: [makeBlock('paragraph', '')],
    tags: [],
    refs: [],
    createdAt: now,
    updatedAt: now,
    ...opts,
  };
}

// --- Markdown block shortcuts (type "# " → heading, etc.) ---------------------

const SHORTCUTS: { re: RegExp; type: BlockType }[] = [
  { re: /^#\s/, type: 'h1' },
  { re: /^##\s/, type: 'h2' },
  { re: /^###\s/, type: 'h3' },
  { re: /^[-*]\s/, type: 'bulleted' },
  { re: /^\d+\.\s/, type: 'numbered' },
  { re: /^\[\]\s/, type: 'todo' },
  { re: /^\[ \]\s/, type: 'todo' },
  { re: /^>\s/, type: 'quote' },
  { re: /^\|\s/, type: 'callout' },
  { re: /^(>>|▶)\s/, type: 'toggle' },
];

/**
 * If `text` begins with a block-shortcut prefix, return the new type and the
 * text with the prefix stripped; else null. The editor calls this as the user
 * types a space, to transform a paragraph in place.
 */
export function detectShortcut(text: string): { type: BlockType; text: string } | null {
  if (/^(---|___|\*\*\*)\s?$/.test(text)) return { type: 'divider', text: '' };
  for (const s of SHORTCUTS) {
    if (s.re.test(text)) return { type: s.type, text: text.replace(s.re, '') };
  }
  return null;
}

// --- Structural block operations (immutable) ---------------------------------

export function updateBlock(blocks: Block[], id: string, patch: Partial<Block>): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, ...patch } : b));
}

export function setBlockType(blocks: Block[], id: string, type: BlockType): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, type } : b));
}

export function toggleChecked(blocks: Block[], id: string): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b));
}

export function toggleCollapsed(blocks: Block[], id: string): Block[] {
  return blocks.map((b) => (b.id === id ? { ...b, collapsed: !b.collapsed } : b));
}

/** Insert `block` immediately after `afterId` (or at the end if not found). */
export function insertAfter(blocks: Block[], afterId: string, block: Block): Block[] {
  const i = blocks.findIndex((b) => b.id === afterId);
  if (i === -1) return [...blocks, block];
  return [...blocks.slice(0, i + 1), block, ...blocks.slice(i + 1)];
}

/** Remove a block; never leaves a doc with zero blocks. */
export function removeBlock(blocks: Block[], id: string): Block[] {
  if (blocks.length <= 1) return [{ ...blocks[0], text: '', type: 'paragraph' }];
  return blocks.filter((b) => b.id !== id);
}

export function moveBlock(blocks: Block[], id: string, dir: -1 | 1): Block[] {
  const i = blocks.findIndex((b) => b.id === id);
  const j = i + dir;
  if (i === -1 || j < 0 || j >= blocks.length) return blocks;
  const next = blocks.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Split a block at `caret` (Enter). The current block keeps the text before the
 * caret; a new block (same type for lists, else paragraph) holds the rest and is
 * inserted right after. Returns the new blocks and the id of the block to focus.
 */
export function splitBlock(blocks: Block[], id: string, caret: number): { blocks: Block[]; focusId: string } {
  const i = blocks.findIndex((b) => b.id === id);
  if (i === -1) return { blocks, focusId: id };
  const b = blocks[i];
  const before = b.text.slice(0, caret);
  const after = b.text.slice(caret);
  // Continuing types (lists/todo) carry to the new block; others become paragraph.
  const carry: BlockType[] = ['bulleted', 'numbered', 'todo'];
  // An empty list item on Enter exits the list (becomes a paragraph, no split).
  if (carry.includes(b.type) && b.text.trim() === '') {
    return { blocks: setBlockType(blocks, id, 'paragraph'), focusId: id };
  }
  const newType: BlockType = carry.includes(b.type) ? b.type : 'paragraph';
  const newBlock = makeBlock(newType, after);
  const next = [...blocks.slice(0, i), { ...b, text: before }, newBlock, ...blocks.slice(i + 1)];
  return { blocks: next, focusId: newBlock.id };
}

/**
 * Merge a block into the previous one (Backspace at offset 0). Returns the new
 * blocks, the id to focus, and the caret offset (end of the previous block's
 * original text). No-op for the first block.
 */
export function mergeWithPrevious(blocks: Block[], id: string): { blocks: Block[]; focusId: string; caret: number } {
  const i = blocks.findIndex((b) => b.id === id);
  if (i <= 0) {
    // First block: if it's a styled block, just demote to paragraph.
    if (i === 0 && blocks[0].type !== 'paragraph') return { blocks: setBlockType(blocks, id, 'paragraph'), focusId: id, caret: 0 };
    return { blocks, focusId: id, caret: 0 };
  }
  const prev = blocks[i - 1];
  const cur = blocks[i];
  const caret = prev.text.length;
  const merged = { ...prev, text: prev.text + cur.text };
  const next = [...blocks.slice(0, i - 1), merged, ...blocks.slice(i + 1)];
  return { blocks: next, focusId: prev.id, caret };
}

// --- Serialization -----------------------------------------------------------

/** Serialize a block to a Markdown line (or lines, for toggle/divider). */
export function blockToMarkdown(b: Block, index: number, siblings: Block[]): string {
  switch (b.type) {
    case 'h1': return `# ${b.text}`;
    case 'h2': return `## ${b.text}`;
    case 'h3': return `### ${b.text}`;
    case 'bulleted': return `- ${b.text}`;
    case 'numbered': {
      // Number within a run of consecutive numbered blocks.
      let n = 1;
      for (let k = index - 1; k >= 0 && siblings[k].type === 'numbered'; k--) n++;
      return `${n}. ${b.text}`;
    }
    case 'todo': return `- [${b.checked ? 'x' : ' '}] ${b.text}`;
    case 'quote': return `> ${b.text}`;
    case 'callout': return `> 💡 ${b.text}`;
    case 'toggle': return `**${b.text}**${b.detail ? `\n${b.detail}` : ''}`;
    case 'divider': return '---';
    default: return b.text;
  }
}

/** Full document → Markdown (title as H1 + blocks). Used for export/share. */
export function docToMarkdown(doc: Doc): string {
  const body = doc.blocks.map((b, i) => blockToMarkdown(b, i, doc.blocks)).join('\n\n');
  const title = doc.title.trim();
  return (title ? `# ${title}\n\n` : '') + body;
}

/** Parse Markdown/plain text into blocks (import + migration of legacy text). */
export function markdownToBlocks(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  for (let raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (line.trim() === '') continue; // collapse blank lines between blocks
    if (/^(---|___|\*\*\*)$/.test(line.trim())) { blocks.push(makeBlock('divider', '')); continue; }
    const todo = line.match(/^\s*[-*]\s\[( |x)\]\s(.*)$/i);
    if (todo) { const b = makeBlock('todo', todo[2]); b.checked = todo[1].toLowerCase() === 'x'; blocks.push(b); continue; }
    const shortcut = detectShortcut(line.replace(/^\s+/, ''));
    if (shortcut) { blocks.push(makeBlock(shortcut.type, shortcut.text)); continue; }
    blocks.push(makeBlock('paragraph', line));
  }
  return blocks.length ? blocks : [makeBlock('paragraph', '')];
}

// --- Derivations -------------------------------------------------------------

/** Plain text of a doc (title + all block text) for search + previews. */
export function docPlainText(doc: Doc): string {
  return [doc.title, ...doc.blocks.map((b) => `${b.text} ${b.detail ?? ''}`)].join(' ').replace(/\s+/g, ' ').trim();
}

/** A short preview line for lists. */
export function docPreview(doc: Doc, max = 120): string {
  const firstBody = doc.blocks.find((b) => b.text.trim() && b.type !== 'divider');
  const s = (firstBody?.text ?? '').replace(/\s+/g, ' ').trim();
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/** All Scripture references linked anywhere in the doc (deduped, canonical). */
export function extractRefs(doc: Doc): string[] {
  const out = new Set<string>();
  if (doc.anchorRef) out.add(doc.anchorRef);
  const scan = (t: string) => {
    for (const seg of linkifyReferences(t)) if (seg.type === 'ref') out.add(seg.reference);
  };
  scan(doc.title);
  for (const b of doc.blocks) { scan(b.text); if (b.detail) scan(b.detail); }
  return Array.from(out);
}

// --- Inline formatting (read mode): **bold**, *italic*/_italic_, and refs ------

export type InlineSeg =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'ref'; v: string; ref: string };

/**
 * Parse a block's plain text into inline segments for the read renderer:
 * Scripture references first (via linkifyReferences), then lightweight markdown
 * marks (`**bold**`, `*italic*`, `_italic_`) inside the non-ref runs. No nesting
 * of marks — kept deliberately simple and predictable.
 */
export function parseInline(text: string): InlineSeg[] {
  const out: InlineSeg[] = [];
  for (const seg of linkifyReferences(text)) {
    if (seg.type === 'ref') {
      out.push({ t: 'ref', v: seg.value, ref: seg.reference });
      continue;
    }
    let rest = seg.value;
    const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_)/;
    let m: RegExpExecArray | null;
    while ((m = re.exec(rest)) !== null) {
      if (m.index > 0) out.push({ t: 'text', v: rest.slice(0, m.index) });
      if (m[2] != null) out.push({ t: 'bold', v: m[2] });
      else out.push({ t: 'italic', v: (m[3] ?? m[4]) as string });
      rest = rest.slice(m.index + m[0].length);
    }
    if (rest) out.push({ t: 'text', v: rest });
  }
  return out;
}

/** True when the doc has no meaningful content (safe to discard). */
export function docIsEmpty(doc: Doc): boolean {
  if (doc.title.trim()) return false;
  return doc.blocks.every((b) => !b.text.trim() && !b.detail?.trim() && b.type !== 'divider');
}
