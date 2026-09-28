import { describe, expect, it } from 'vitest';
import { approach, EXPRESSIONS, expressionAt, FACE_KEYS, MAX_TALK_AHEAD, mouthPath, talkUntil, TONE_LINGER } from '../src/ui/producerFace';

/** The lips' control points' heights, from a mouth path. */
function lips(d: string) {
  const [upper, lower] = [...d.matchAll(/Q0 (-?[\d.]+)/g)].map((m) => Number(m[1]));
  return { upper, lower };
}

describe('the Producer’s face', () => {
  it('has every part of the face in every expression', () => {
    for (const face of Object.values(EXPRESSIONS)) {
      expect(Object.keys(face).sort()).toEqual([...FACE_KEYS].sort());
      expect(Object.values(face).every(Number.isFinite)).toBe(true);
    }
  });

  it('smiles when happy, frowns when concerned, and puts a hand to his chin when thinking', () => {
    expect(EXPRESSIONS.happy.smile).toBeGreaterThan(EXPRESSIONS.idle.smile);
    expect(EXPRESSIONS.concerned.smile).toBeLessThan(0);
    expect(EXPRESSIONS.concerned.browTilt).toBeGreaterThan(0);
    expect(EXPRESSIONS.thinking.hand).toBe(1);
  });

  it('draws a mouth whose lower lip always stays below the upper one', () => {
    for (const smile of [-1, -0.5, 0, 0.5, 1]) {
      for (const open of [0, 0.3, 1]) {
        const d = mouthPath({ smile, open, width: 1 });
        expect(d).toMatch(/^M-9 -?[\d.]+Q0 -?[\d.]+ 9 -?[\d.]+Q0 -?[\d.]+ -9 -?[\d.]+Z$/);
        const { upper, lower } = lips(d);
        expect(lower).toBeGreaterThan(upper);
      }
    }
  });

  it('opens wider as it opens, and lifts its corners as it smiles', () => {
    const closed = lips(mouthPath({ smile: 0, open: 0, width: 1 }));
    const open = lips(mouthPath({ smile: 0, open: 1, width: 1 }));
    expect(open.lower - open.upper).toBeGreaterThan(closed.lower - closed.upper);
    expect(mouthPath({ smile: 1, open: 0, width: 1 })).toMatch(/^M-9 -3Q/);
    expect(mouthPath({ smile: -1, open: 0, width: 1 })).toMatch(/^M-9 3Q/);
  });

  it('keeps talking in proportion to the words, but not for ever', () => {
    expect(talkUntil(0, 1000, 10)).toBe(1300);
    expect(talkUntil(1300, 1100, 10)).toBe(1600);
    expect(talkUntil(0, 1000, 10_000)).toBe(1000 + MAX_TALK_AHEAD);
  });

  it('shows a reply’s feeling while it lasts, then goes back to the conversation', () => {
    expect(expressionAt('idle', 'happy', 2000, 1500)).toBe('happy');
    expect(expressionAt('idle', 'happy', 2000, 2500)).toBe('idle');
    expect(expressionAt('listening', 'neutral', 9999, 0)).toBe('listening');
    expect(TONE_LINGER.concerned).toBeGreaterThan(TONE_LINGER.happy);
  });

  it('eases the same way at any frame rate', () => {
    const oneStep = approach(0, 1, 0.1, 8);
    let twoSteps = approach(0, 1, 0.05, 8);
    twoSteps = approach(twoSteps, 1, 0.05, 8);
    expect(oneStep).toBeCloseTo(twoSteps, 10);
    expect(approach(0, 1, 10, 8)).toBeCloseTo(1, 5);
  });
});
