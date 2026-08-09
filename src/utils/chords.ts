/**
 * Chord utilities for the hymnal. Lyrics are stored ChordPro-style with inline
 * chords in brackets: "A-[G]mazing [G7]grace how [C]sweet the [G]sound". These
 * pure helpers parse a line into chord/lyric segments and transpose chords by a
 * number of semitones (for the key/transpose control). No React imports.
 */

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_TO_SHARP: Record<string, string> = { Db: 'C#', Eb: 'D#', Gb: 'F#', Ab: 'G#', Bb: 'A#', Cb: 'B', Fb: 'E' };

/** Index (0-11) of a note name, accepting sharps or flats, or -1 if unknown. */
function noteIndex(note: string): number {
  const n = FLAT_TO_SHARP[note] ?? note;
  return SHARP.indexOf(n);
}

function shiftNote(note: string, semitones: number): string {
  const i = noteIndex(note);
  if (i < 0) return note;
  return SHARP[(((i + semitones) % 12) + 12) % 12];
}

const ROOT_RE = /^([A-G][#b]?)(.*)$/;

/** Transpose a single chord token (with optional suffix and /bass) by semitones. */
export function transposeChord(chord: string, semitones: number): string {
  if (!chord) return chord;
  const [main, bass] = chord.split('/');
  const m = main.match(ROOT_RE);
  if (!m) return chord;
  const root = shiftNote(m[1], semitones);
  let out = root + m[2];
  if (bass) {
    const bm = bass.match(ROOT_RE);
    out += '/' + (bm ? shiftNote(bm[1], semitones) + bm[2] : bass);
  }
  return out;
}

/** Transpose every [chord] in a ChordPro line by semitones. */
export function transposeLine(line: string, semitones: number): string {
  return line.replace(/\[([^\]]+)\]/g, (_all, c) => `[${transposeChord(c, semitones)}]`);
}

/** Transpose a key name (e.g. "G" -> "A" for +2). */
export function transposeKey(key: string, semitones: number): string {
  return transposeChord(key, semitones);
}

export interface ChordSegment {
  chord?: string;
  text: string;
}

/** Split a ChordPro line into ordered {chord?, text} segments for rendering. */
export function parseChordLine(line: string, semitones = 0): ChordSegment[] {
  const segments: ChordSegment[] = [];
  const re = /\[([^\]]+)\]/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  // Leading text before the first chord.
  const first = line.search(/\[/);
  if (first > 0) segments.push({ text: line.slice(0, first) });
  else if (first === -1) return [{ text: line }];
  lastIndex = first;
  while ((m = re.exec(line)) !== null) {
    const chord = semitones ? transposeChord(m[1], semitones) : m[1];
    const textStart = m.index + m[0].length;
    const nextChord = line.indexOf('[', textStart);
    const text = line.slice(textStart, nextChord === -1 ? undefined : nextChord);
    segments.push({ chord, text });
    lastIndex = textStart;
  }
  return segments;
}
