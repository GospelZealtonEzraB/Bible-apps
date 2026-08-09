import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useTheme, spacing, font, radius } from '@/theme';
import { Button } from '@/components/ui';
import { isLatinTranslation } from '@/data/bibleApi';
import { useStore } from '@/store/useStore';
import type { Verse } from '@/types';
import {
  tokenize,
  toFirstLetters,
  hiddenIndicesForLevel,
  pickBlankIndices,
  diffWords,
  normalizeWord,
  pickDistractors,
  type Token,
} from '@/drills/helpers';

/** Well-known references used to pad multiple-choice options for small libraries. */
const FALLBACK_REFS = [
  'John 3:16', 'Romans 8:28', 'Philippians 4:13', 'Psalms 23:1', 'Genesis 1:1',
  'Proverbs 3:5', 'Jeremiah 29:11', 'Isaiah 41:10', 'Matthew 6:33', 'Joshua 1:9',
  'Romans 12:2', 'Galatians 2:20',
];

/** Verse text uses the serif face for Latin scripts, the system font otherwise
 * (Georgia has no Tamil glyphs). */
const verseFont = (translation: string): string | undefined =>
  isLatinTranslation(translation) ? font.serif : undefined;

export interface DrillProps {
  verse: Verse;
  /** Called when the learner finishes a pass, with 0..100 accuracy/confidence. */
  onComplete: (accuracy: number) => void;
}

const VANISH_MAX_LEVEL = 5;

// ---- Shared bits ----------------------------------------------------------

function Prompt({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.textMuted,
        fontSize: font.sizes.sm,
        textAlign: 'center',
        marginBottom: spacing.md,
      }}
    >
      {children}
    </Text>
  );
}

function WordRow({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'center',
        rowGap: 10,
      }}
    >
      {children}
    </View>
  );
}

// ---- Multiple choice ------------------------------------------------------

/** Build four shuffled reference options (correct + 3 distractors). */
function buildReferenceOptions(correctRef: string, versesRecord: Record<string, Verse>): string[] {
  const pool = [
    ...Object.values(versesRecord).map((v) => v.reference).filter((r) => r !== correctRef),
    ...FALLBACK_REFS,
  ];
  const all = [correctRef, ...pickDistractors(correctRef, pool, 3)];
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all;
}

/** Show the verse text; pick the correct reference from four options. */
export function ChoiceDrill({ verse, onComplete }: DrillProps) {
  const { colors } = useTheme();
  const versesRecord = useStore((s) => s.verses);

  const options = useMemo(() => buildReferenceOptions(verse.reference, versesRecord), [verse.reference, versesRecord]);

  const [picked, setPicked] = useState<string | null>(null);
  const correct = picked === verse.reference;

  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
      <Prompt>Which reference is this?</Prompt>
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: font.sizes.lg, lineHeight: 30, fontFamily: verseFont(verse.translation) }}>
          "{verse.text}"
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {options.map((opt) => {
          const isPicked = picked === opt;
          const isAnswer = opt === verse.reference;
          const show = picked !== null;
          const bg = show && isAnswer ? colors.success : show && isPicked ? colors.danger : colors.surfaceAlt;
          const fg = show && (isAnswer || isPicked) ? '#fff' : colors.text;
          return (
            <Pressable
              key={opt}
              disabled={picked !== null}
              onPress={() => setPicked(opt)}
              style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: bg }}
            >
              <Text style={{ color: fg, fontWeight: '700', fontSize: font.sizes.md }}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>

      {picked !== null ? (
        <Button
          title={correct ? 'Correct! Continue' : 'Continue'}
          onPress={() => onComplete(correct ? 100 : 40)}
        />
      ) : null}
    </View>
  );
}

// ---- Speed round ----------------------------------------------------------

const SPEED_SECONDS = 12;

/** Timed multiple-choice: pick the right reference before the clock runs out. */
export function SpeedDrill({ verse, onComplete }: DrillProps) {
  const { colors } = useTheme();
  const versesRecord = useStore((s) => s.verses);
  const options = useMemo(() => buildReferenceOptions(verse.reference, versesRecord), [verse.reference, versesRecord]);

  const [left, setLeft] = useState(SPEED_SECONDS);
  const [picked, setPicked] = useState<string | null>(null);
  const fired = useRef(false);

  const finish = (acc: number) => {
    if (fired.current) return;
    fired.current = true;
    onComplete(acc);
  };

  useEffect(() => {
    if (picked !== null) return;
    if (left <= 0) { finish(30); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, picked]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (opt: string) => {
    if (picked !== null) return;
    setPicked(opt);
    const correct = opt === verse.reference;
    finish(correct ? (left > SPEED_SECONDS / 2 ? 100 : 90) : 40);
  };

  const pct = Math.max(0, (left / SPEED_SECONDS) * 100);
  const barColor = left <= 3 ? colors.danger : left <= 6 ? colors.warning : colors.success;

  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: spacing.lg }}>
      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ color: colors.textMuted, fontSize: font.sizes.sm }}>Which reference is this?</Text>
          <Text style={{ color: barColor, fontWeight: '800', fontSize: font.sizes.sm }}>{left}s</Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
          <View style={{ width: `${pct}%`, height: 8, backgroundColor: barColor }} />
        </View>
      </View>

      <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
        <Text style={{ color: colors.text, fontSize: font.sizes.lg, lineHeight: 30, fontFamily: verseFont(verse.translation) }}>"{verse.text}"</Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        {options.map((opt) => {
          const show = picked !== null;
          const isAnswer = opt === verse.reference;
          const isPicked = picked === opt;
          const bg = show && isAnswer ? colors.success : show && isPicked ? colors.danger : colors.surfaceAlt;
          const fg = show && (isAnswer || isPicked) ? '#fff' : colors.text;
          return (
            <Pressable key={opt} disabled={show} onPress={() => pick(opt)} style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: bg }}>
              <Text style={{ color: fg, fontWeight: '700', fontSize: font.sizes.md }}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ---- Flashcards -----------------------------------------------------------

export function FlashcardDrill({ verse, onComplete }: DrillProps) {
  const { colors } = useTheme();
  const [reverse, setReverse] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const front = reverse ? verse.text : verse.reference;
  const back = reverse ? verse.reference : verse.text;

  const rate = (accuracy: number) => onComplete(accuracy);

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <View style={{ alignItems: 'flex-end' }}>
        <Pressable
          onPress={() => {
            setReverse((r) => !r);
            setFlipped(false);
          }}
          style={{
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
            padding: spacing.sm,
          }}
        >
          <Ionicons name="swap-horizontal" size={16} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {reverse ? 'Verse → Reference' : 'Reference → Verse'}
          </Text>
        </Pressable>
      </View>

      <Pressable
        onPress={() => setFlipped((f) => !f)}
        style={{
          flex: 1,
          marginVertical: spacing.lg,
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            color: flipped ? colors.text : colors.primary,
            fontSize: flipped ? font.sizes.lg : font.sizes.xl,
            lineHeight: flipped ? 30 : 38,
            fontWeight: flipped ? '400' : '800',
            textAlign: 'center',
            fontFamily: flipped ? verseFont(verse.translation) : undefined,
          }}
        >
          {flipped ? `"${back}"` : front}
        </Text>
        <Text style={{ color: colors.textFaint, marginTop: spacing.lg, fontSize: font.sizes.xs }}>
          {flipped ? 'tap to hide' : 'tap to reveal'}
        </Text>
      </Pressable>

      {flipped ? (
        <View style={{ gap: spacing.sm }}>
          <Prompt>How well did you recall it?</Prompt>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button title="Again" variant="secondary" style={{ flex: 1 }} onPress={() => rate(30)} />
            <Button title="Good" variant="secondary" style={{ flex: 1 }} onPress={() => rate(75)} />
            <Button title="Easy" style={{ flex: 1 }} onPress={() => rate(100)} />
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.textFaint, textAlign: 'center' }}>
          Say it out loud, then reveal to check.
        </Text>
      )}
    </View>
  );
}

// ---- Vanishing Words ------------------------------------------------------

export function VanishingDrill({ verse, onComplete }: DrillProps) {
  const { colors } = useTheme();
  const tokens = useMemo(() => tokenize(verse.text), [verse.text]);
  const [level, setLevel] = useState(1);
  const [peeked, setPeeked] = useState<Set<number>>(new Set());

  const hidden = useMemo(
    () => hiddenIndicesForLevel(tokens, level, VANISH_MAX_LEVEL),
    [tokens, level],
  );

  const togglePeek = (i: number) =>
    setPeeked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const atMax = level >= VANISH_MAX_LEVEL;

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <Prompt>Recite the verse. Fade more words each time you get it right.</Prompt>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <WordRow>
          {tokens.map((t, i) => {
            const isHidden = hidden.has(i) && !peeked.has(i);
            return (
              <Pressable key={i} onPress={() => isHidden || hidden.has(i) ? togglePeek(i) : undefined}>
                <Text
                  style={{
                    fontSize: font.sizes.lg,
                    lineHeight: 32,
                    marginHorizontal: 4,
                    fontFamily: verseFont(verse.translation),
                    color: isHidden ? 'transparent' : colors.text,
                    borderBottomWidth: isHidden ? 2 : 0,
                    borderBottomColor: colors.textFaint,
                    minWidth: isHidden ? Math.max(18, t.word.length * 10) : undefined,
                    textAlign: 'center',
                  }}
                >
                  {isHidden ? ' ' : t.raw}
                </Text>
              </Pressable>
            );
          })}
        </WordRow>
        <Text style={{ color: colors.textFaint, textAlign: 'center', marginTop: spacing.lg }}>
          Fade level {level} / {VANISH_MAX_LEVEL} · tap a blank to peek
        </Text>
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="Reset"
            variant="ghost"
            style={{ flex: 1 }}
            onPress={() => {
              setLevel(1);
              setPeeked(new Set());
            }}
          />
          {!atMax ? (
            <Button
              title="Fade more"
              style={{ flex: 2 }}
              icon={<Ionicons name="eye-off" size={18} color={colors.onPrimary} />}
              onPress={() => {
                setLevel((l) => Math.min(VANISH_MAX_LEVEL, l + 1));
                setPeeked(new Set());
              }}
            />
          ) : (
            <Button
              title="I recited it all!"
              style={{ flex: 2 }}
              icon={<Ionicons name="checkmark" size={18} color={colors.onPrimary} />}
              onPress={() => onComplete(100)}
            />
          )}
        </View>
      </View>
    </View>
  );
}

// ---- First Letters --------------------------------------------------------

export function FirstLetterDrill({ verse, onComplete }: DrillProps) {
  const { colors } = useTheme();
  const scaffold = useMemo(() => toFirstLetters(verse.text), [verse.text]);
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <Prompt>Each letter is the start of a word. Recite the whole verse.</Prompt>

      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text
          style={{
            color: colors.text,
            fontSize: font.sizes.xxl,
            lineHeight: 46,
            letterSpacing: 2,
            textAlign: 'center',
            fontWeight: '700',
          }}
        >
          {scaffold}
        </Text>
        {revealed ? (
          <Text
            style={{
              color: colors.textMuted,
              fontSize: font.sizes.md,
              lineHeight: 26,
              textAlign: 'center',
              marginTop: spacing.xl,
              fontFamily: verseFont(verse.translation),
            }}
          >
            "{verse.text}"
          </Text>
        ) : null}
      </View>

      <View style={{ gap: spacing.sm }}>
        {!revealed ? (
          <Button
            title="Reveal full verse"
            variant="secondary"
            icon={<Ionicons name="eye" size={18} color={colors.text} />}
            onPress={() => setRevealed(true)}
          />
        ) : (
          <>
            <Prompt>Did you get it right?</Prompt>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Not yet" variant="secondary" style={{ flex: 1 }} onPress={() => onComplete(40)} />
              <Button title="Nailed it" style={{ flex: 1 }} onPress={() => onComplete(100)} />
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// ---- Fill & Type ----------------------------------------------------------

type BlankMode = 'blanks' | 'type';

export function BlankDrill({ verse, onComplete }: DrillProps) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<BlankMode>('blanks');

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.pill,
          padding: 4,
          marginBottom: spacing.lg,
        }}
      >
        {(['blanks', 'type'] as BlankMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => setMode(m)}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.pill,
              alignItems: 'center',
              backgroundColor: mode === m ? colors.primary : 'transparent',
            }}
          >
            <Text
              style={{
                color: mode === m ? colors.onPrimary : colors.textMuted,
                fontWeight: '700',
              }}
            >
              {m === 'blanks' ? 'Fill blanks' : 'Type it out'}
            </Text>
          </Pressable>
        ))}
      </View>

      {mode === 'blanks' ? (
        <FillBlanks verse={verse} onComplete={onComplete} />
      ) : (
        <TypeItOut verse={verse} onComplete={onComplete} />
      )}
    </View>
  );
}

function FillBlanks({ verse, onComplete }: DrillProps) {
  const { colors } = useTheme();
  const tokens = useMemo(() => tokenize(verse.text), [verse.text]);
  const blanks = useMemo(() => pickBlankIndices(tokens, 0.35), [tokens]);
  const blankSet = useMemo(() => new Set(blanks), [blanks]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checked, setChecked] = useState(false);

  const correctFor = (i: number) =>
    normalizeWord(answers[i] ?? '') === normalizeWord(tokens[i].word);

  const onCheck = () => setChecked(true);

  const accuracy = () =>
    blanks.length === 0
      ? 100
      : Math.round((blanks.filter(correctFor).length / blanks.length) * 100);

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <Prompt>Fill in the missing words.</Prompt>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <WordRow>
          {tokens.map((t: Token, i) => {
            if (!blankSet.has(i)) {
              return (
                <Text
                  key={i}
                  style={{
                    color: colors.text,
                    fontSize: font.sizes.md,
                    lineHeight: 34,
                    marginHorizontal: 3,
                    fontFamily: verseFont(verse.translation),
                  }}
                >
                  {t.raw}
                </Text>
              );
            }
            const ok = correctFor(i);
            const borderColor = !checked
              ? colors.primary
              : ok
                ? colors.success
                : colors.danger;
            return (
              <View key={i} style={{ marginHorizontal: 3 }}>
                <TextInput
                  value={answers[i] ?? ''}
                  editable={!checked}
                  onChangeText={(txt) => setAnswers((a) => ({ ...a, [i]: txt }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={'·'.repeat(Math.max(3, t.word.length))}
                  placeholderTextColor={colors.textFaint}
                  style={{
                    minWidth: Math.max(46, t.word.length * 12),
                    color: checked && !ok ? colors.danger : colors.text,
                    fontSize: font.sizes.md,
                    textAlign: 'center',
                    borderBottomWidth: 2,
                    borderBottomColor: borderColor,
                    paddingVertical: 2,
                  }}
                />
                {checked && !ok ? (
                  <Text style={{ color: colors.success, fontSize: font.sizes.xs, textAlign: 'center' }}>
                    {t.word}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </WordRow>
      </View>

      {!checked ? (
        <Button title="Check answers" onPress={onCheck} />
      ) : (
        <Button
          title="Done"
          icon={<Ionicons name="checkmark" size={18} color={colors.onPrimary} />}
          onPress={() => onComplete(accuracy())}
        />
      )}
    </View>
  );
}

function TypeItOut({ verse, onComplete }: DrillProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReturnType<typeof diffWords> | null>(null);

  const onCheck = () => {
    setResult(diffWords(verse.text, text));
  };

  const verdictColor = (v: string) =>
    v === 'correct' ? colors.success : v === 'wrong' ? colors.danger : colors.textFaint;

  return (
    <View style={{ flex: 1, justifyContent: 'space-between' }}>
      <Prompt>Type the verse from memory. Reference: {verse.reference}</Prompt>

      {!result ? (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            autoFocus
            placeholder="Start typing the verse…"
            placeholderTextColor={colors.textFaint}
            style={{
              flex: 1,
              color: colors.text,
              fontSize: font.sizes.lg,
              lineHeight: 30,
              textAlignVertical: 'top',
              backgroundColor: colors.surface,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.border,
              padding: spacing.lg,
              marginBottom: spacing.lg,
              fontFamily: verseFont(verse.translation),
            }}
          />
          <Button title="Check accuracy" onPress={onCheck} disabled={!text.trim()} />
        </>
      ) : (
        <>
          <View style={{ flex: 1, justifyContent: 'center' }}>
            <Text
              style={{
                color: result.accuracy >= 90 ? colors.success : colors.text,
                fontSize: font.sizes.display,
                fontWeight: '800',
                textAlign: 'center',
              }}
            >
              {result.accuracy}%
            </Text>
            <Text style={{ color: colors.textMuted, textAlign: 'center', marginBottom: spacing.lg }}>
              {result.correct} of {result.total} words
            </Text>
            <WordRow>
              {result.diffs.map((d, i) => (
                <Text
                  key={i}
                  style={{
                    color: verdictColor(d.verdict),
                    fontSize: font.sizes.md,
                    lineHeight: 28,
                    marginHorizontal: 3,
                    textDecorationLine: d.verdict === 'wrong' ? 'line-through' : 'none',
                    fontFamily: verseFont(verse.translation),
                  }}
                >
                  {d.expected ?? d.typed}
                </Text>
              ))}
            </WordRow>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Try again"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setText('');
                setResult(null);
              }}
            />
            <Button title="Done" style={{ flex: 1 }} onPress={() => onComplete(result.accuracy)} />
          </View>
        </>
      )}
    </View>
  );
}
