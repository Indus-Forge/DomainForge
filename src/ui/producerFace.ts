/**
 * The Producer's face: a small rig of numbers (how open the eyes are, where
 * they look, how the mouth curves…) and the expressions made from them.
 * ProducerCharacter eases towards these every frame. Nothing here touches
 * React or the page, so the face can be tested on its own.
 */

/** What the conversation is doing: set by the Producer panel. */
export type Mood = 'idle' | 'listening' | 'thinking';
/** How a reply feels, shown while and after it is said. */
export type Tone = 'neutral' | 'happy' | 'concerned';
export type Expression = Mood | 'happy' | 'concerned';

export interface Face {
  /** 0 closed … 1 open (a little over 1 is wide-eyed). */
  eyeOpen: number;
  /** 0 … 1: cheeks pushing up under the eyes, as in a real smile. */
  lowerLid: number;
  /** Where the eyes look, -1 … 1 (left/up to right/down). */
  lookX: number;
  lookY: number;
  /** How far each eyebrow is raised, in drawing units. */
  browL: number;
  browR: number;
  /** Positive lifts the inner ends of the eyebrows (worried); negative lowers them (focused). */
  browTilt: number;
  /** -1 frown … 1 grin. */
  smile: number;
  /** 0 closed … 1 wide open. */
  open: number;
  /** Mouth width, 1 is normal. */
  width: number;
  /** Mouth pushed to one side, in drawing units (a thinking "hmm"). */
  mouthX: number;
  /** Head tilt in degrees. */
  tilt: number;
  /** 0 … 1 leaning in towards the person. */
  lean: number;
  /** 0 … 1 rosy cheeks. */
  blush: number;
  /** 0 hand out of sight … 1 hand on chin. */
  hand: number;
}

export const EXPRESSIONS: Record<Expression, Face> = {
  idle: { eyeOpen: 1, lowerLid: 0.08, lookX: 0, lookY: 0, browL: 0, browR: 0, browTilt: 0, smile: 0.4, open: 0, width: 1, mouthX: 0, tilt: 0, lean: 0, blush: 0.25, hand: 0 },
  listening: { eyeOpen: 1.08, lowerLid: 0, lookX: 0, lookY: 0.55, browL: 1.6, browR: 1.6, browTilt: 0.15, smile: 0.3, open: 0.04, width: 0.95, mouthX: 0, tilt: 6, lean: 1, blush: 0.3, hand: 0 },
  thinking: { eyeOpen: 0.88, lowerLid: 0.1, lookX: -0.65, lookY: -0.8, browL: 2.6, browR: -0.6, browTilt: -0.2, smile: 0.05, open: 0.06, width: 0.62, mouthX: 2.5, tilt: -7, lean: 0, blush: 0.2, hand: 1 },
  happy: { eyeOpen: 0.82, lowerLid: 0.62, lookX: 0, lookY: 0, browL: 1.8, browR: 1.8, browTilt: 0.1, smile: 1, open: 0.34, width: 1.18, mouthX: 0, tilt: 3, lean: 0.3, blush: 0.75, hand: 0 },
  concerned: { eyeOpen: 0.92, lowerLid: 0.05, lookX: 0, lookY: 0.35, browL: 0.6, browR: 0.6, browTilt: 1, smile: -0.5, open: 0.06, width: 0.8, mouthX: 0, tilt: -4, lean: 0, blush: 0, hand: 0 },
};

export const FACE_KEYS = Object.keys(EXPRESSIONS.idle) as (keyof Face)[];

/** Mouth shapes for talking: cycled while words arrive, so the mouth moves like speech. */
export const VISEMES: { open: number; width: number }[] = [
  { open: 0.62, width: 1 }, // "ah"
  { open: 0.3, width: 1.12 }, // "eh"
  { open: 0.44, width: 0.72 }, // "oh"
  { open: 0.16, width: 1.05 }, // "mm", nearly closed
  { open: 0.52, width: 0.9 },
  { open: 0.24, width: 0.8 }, // "oo"
];

/** How long a message keeps the mouth moving: about 30 ms a letter, never more than 3.5 s ahead. */
export const MS_PER_CHAR = 30;
export const MAX_TALK_AHEAD = 3500;

export function talkUntil(current: number, now: number, chars: number): number {
  return Math.min(Math.max(current, now) + chars * MS_PER_CHAR, now + MAX_TALK_AHEAD);
}

/** How long a feeling stays on the face after the words stop. */
export const TONE_LINGER: Record<Tone, number> = { neutral: 0, happy: 2200, concerned: 4500 };

/** Which expression to show: a reply's feeling wins while it lasts, then the conversation's mood. */
export function expressionAt(mood: Mood, tone: Tone, toneUntil: number, now: number): Expression {
  return tone !== 'neutral' && now < toneUntil ? tone : mood;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const n = (v: number) => Number(v.toFixed(2));

/**
 * The mouth as a closed shape centred on (0, 0): an upper and a lower lip, each
 * one curve between the corners. Smiling lifts the corners; opening drops the
 * lower lip. The lower lip always stays below the upper one.
 */
export function mouthPath(face: Pick<Face, 'smile' | 'open' | 'width'>, halfWidth = 9): string {
  const w = n(halfWidth * clamp(face.width, 0.3, 1.6));
  const c = clamp(face.smile, -1, 1);
  const o = clamp(face.open, 0, 1);
  const corner = -c * 3;
  // A quadratic curve passes halfway between its ends and its control point, so the control sits twice as far out.
  const upperMid = c * 2.5 - o * 3;
  const lowerMid = c * 2.5 + 1.4 + o * 11 + Math.max(c, 0) * 2.5;
  const cu = 2 * upperMid - corner;
  const cl = 2 * lowerMid - corner;
  return `M${-w} ${n(corner)}Q0 ${n(cu)} ${w} ${n(corner)}Q0 ${n(cl)} ${-w} ${n(corner)}Z`;
}

/** Eases a value towards its target, the same at any frame rate. Higher rates are snappier. */
export function approach(current: number, target: number, seconds: number, rate: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * seconds));
}
