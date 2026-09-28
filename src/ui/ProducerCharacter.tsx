import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  approach,
  EXPRESSIONS,
  expressionAt,
  FACE_KEYS,
  mouthPath,
  talkUntil,
  TONE_LINGER,
  VISEMES,
  type Expression,
  type Face,
  type Mood,
  type Tone,
} from './producerFace';

export interface ProducerHandle {
  /** Says something: the mouth moves for a moment in proportion to its length, with a feeling. */
  say(chars: number, tone?: Tone): void;
  /** Waves and smiles. */
  cheer(): void;
}

type Shown = Expression | 'talking' | 'waving';

const STATUS: Record<Shown, string> = {
  idle: 'Ready when you are',
  listening: 'Listening…',
  thinking: 'Thinking about your board…',
  talking: 'Explaining…',
  happy: 'Here you go!',
  concerned: 'Hmm, let’s find another way',
  waving: 'Hi there!',
};

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
const f = (v: number) => v.toFixed(2);

/**
 * The Producer, drawn: a small character with a producer's headset who
 * listens while you type, thinks while the AI works, talks as the reply
 * arrives and reacts to how it went. The face is a rig of numbers
 * (producerFace.ts) eased towards an expression every frame and written
 * straight to the drawing, so animating never re-renders React.
 */
export function ProducerCharacter({ mood, ref }: { mood: Mood; ref?: Ref<ProducerHandle> }) {
  const id = useId().replace(/[^\w-]/g, '');
  const stage = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState(STATUS.waving);
  // What the animation reads between frames. Kept out of React state so frames never re-render.
  const live = useRef({
    mood,
    tone: 'neutral' as Tone,
    toneUntil: 0,
    toneStart: 0,
    talkUntil: 0,
    waveUntil: 0,
    pointer: null as null | { x: number; y: number; at: number },
  });

  const cheer = () => {
    const l = live.current;
    const now = performance.now();
    l.waveUntil = now + 1600;
    l.tone = 'happy';
    l.toneStart = now;
    l.toneUntil = now + 1900;
  };

  useImperativeHandle(ref, () => ({
    say(chars, tone = 'neutral') {
      const l = live.current;
      const now = performance.now();
      l.talkUntil = talkUntil(l.talkUntil, now, chars);
      if (tone === 'neutral') return;
      if (l.tone !== tone || now >= l.toneUntil) l.toneStart = now;
      l.tone = tone;
      l.toneUntil = Math.max(l.talkUntil, now) + TONE_LINGER[tone];
    },
    cheer,
  }));

  useEffect(() => {
    const l = live.current;
    l.mood = mood;
    // A new turn has started: the last reply's feeling gives way to listening or thinking.
    if (mood !== 'idle') l.toneUntil = 0;
  }, [mood]);

  useEffect(() => {
    const root = stage.current!;
    const part = <T extends Element = SVGElement>(name: string) => root.querySelector(`[data-part="${name}"]`) as T;
    const el = {
      body: part('body'),
      head: part('head'),
      tuft: part('tuft'),
      eyeL: part('eyeL'),
      eyeR: part('eyeR'),
      pupilL: part('pupilL'),
      pupilR: part('pupilR'),
      lidL: part('lidL'),
      lidR: part('lidR'),
      browL: part('browL'),
      browR: part('browR'),
      cheeks: part('cheeks'),
      mouth: part('mouth'),
      mouthShape: part('mouthShape'),
      mouthClip: part('mouthClip'),
      tongue: part('tongue'),
      mic: part('mic'),
      hand: part('hand'),
    };
    const svg = root.querySelector('svg')!;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const motion = reduce ? 0 : 1;

    const onPointer = (e: PointerEvent) => {
      const box = svg.getBoundingClientRect();
      const x = e.clientX - (box.left + box.width / 2);
      const y = e.clientY - (box.top + box.height * 0.45);
      live.current.pointer = { x: clamp1(x / 260), y: clamp1(y / 200), at: performance.now() };
    };
    window.addEventListener('pointermove', onPointer, { passive: true });

    const face: Face = { ...EXPRESSIONS.idle };
    let last = performance.now();
    let raf = 0;
    let nextBlink = last + 1400;
    let blinkAt = -Infinity;
    let doubleBlink = false;
    let nextGlance = last + 1800;
    let glance = { x: 0, y: 0 };
    let nextViseme = 0;
    let viseme = VISEMES[0];
    let nextEmphasis = 0;
    let emphasisUntil = 0;
    let tuft = 0;
    let tuftSpeed = 0;
    let lastHeadY = 0;
    let lastTilt = 0;
    let mic = 0.15;
    const hand = { x: 80, y: 140, r: 10 };
    let shown: Shown | '' = '';

    const frame = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      const l = live.current;
      const expression = expressionAt(l.mood, l.tone, l.toneUntil, now);
      const talking = now < l.talkUntil;
      const waving = now < l.waveUntil;
      const target: Face = { ...EXPRESSIONS[expression] };

      // Eyes: follow the pointer while idle; otherwise glance about now and then.
      const pointer = l.pointer && now - l.pointer.at < 2500 ? l.pointer : null;
      if (expression === 'idle' && pointer) {
        target.lookX = pointer.x;
        target.lookY = pointer.y;
      } else if (expression === 'idle' || expression === 'listening') {
        if (now > nextGlance) {
          const range = expression === 'idle' ? 0.6 : 0.25;
          glance = Math.random() < 0.35 ? { x: 0, y: 0 } : { x: rand(-range, range), y: rand(-range * 0.6, range * 0.6) };
          nextGlance = now + rand(900, 3200);
        }
        target.lookX += glance.x;
        target.lookY += glance.y;
      }

      // Talking: a new mouth shape every 70 to 120 ms, eyes on the person, eyebrows lifting on some words.
      if (talking) {
        if (now > nextViseme) {
          viseme = Math.random() < 0.18 ? { open: 0.04, width: 0.95 } : VISEMES[Math.floor(Math.random() * VISEMES.length)];
          nextViseme = now + rand(70, 120);
        }
        target.open = viseme.open * (expression === 'concerned' ? 0.6 : 1);
        target.width *= viseme.width;
        target.lookX *= 0.3;
        target.lookY *= 0.3;
        target.hand = 0;
        if (now > nextEmphasis) {
          emphasisUntil = now + 260;
          nextEmphasis = now + rand(700, 1600);
        }
        if (now < emphasisUntil) {
          target.browL += 1.3;
          target.browR += 1.3;
        }
      }

      // Blinking, sometimes twice.
      if (now > nextBlink) {
        blinkAt = now;
        nextBlink = now + rand(2600, 5600);
        doubleBlink = Math.random() < 0.2;
      }
      const sinceBlink = now - blinkAt;
      let blink = 1;
      if (sinceBlink < 150) blink = 1 - Math.sin((Math.PI * sinceBlink) / 150) * 0.95;
      else if (doubleBlink && sinceBlink > 230 && sinceBlink < 380) blink = 1 - Math.sin((Math.PI * (sinceBlink - 230)) / 150) * 0.95;

      for (const k of FACE_KEYS) {
        const rate = k === 'lookX' || k === 'lookY' ? 16 : talking && (k === 'open' || k === 'width') ? 24 : k === 'hand' ? 7 : 8;
        face[k] = approach(face[k], target[k], dt, rate);
      }

      // The body breathes, bobs while talking and hops when happy; the hair tuft springs behind.
      const t = now / 1000;
      const breathe = Math.sin((t * 2 * Math.PI) / 3.4);
      const sinceTone = now - l.toneStart;
      const hop = expression === 'happy' && sinceTone < 520 ? Math.sin((Math.PI * sinceTone) / 520) : 0;
      const headY = motion * (breathe * 1.1 + (talking ? Math.sin(t * 11) * 0.9 : 0) - hop * 6 + face.lean * 2);
      const tilt = face.tilt + motion * (Math.sin(t * 0.8) * 1.2 + (talking ? Math.sin(t * 3.3) * 2 : 0));
      const push = ((headY - lastHeadY) / dt) * 14 + ((tilt - lastTilt) / dt) * 3;
      lastHeadY = headY;
      lastTilt = tilt;
      tuftSpeed += (-160 * tuft - 10 * tuftSpeed - push) * dt;
      tuft = Math.max(-25, Math.min(25, tuft + tuftSpeed * dt));
      mic = approach(mic, talking ? 1 : 0.15, dt, 12);

      const handTo = waving
        ? { x: 107, y: 54, r: Math.sin(t * 13) * 24 - 8 }
        : { x: 80 - face.hand * 11, y: 140 - face.hand * 50, r: 10 - face.hand * 38 };
      hand.x = approach(hand.x, handTo.x, dt, waving ? 14 : 9);
      hand.y = approach(hand.y, handTo.y, dt, waving ? 14 : 9);
      hand.r = approach(hand.r, handTo.r, dt, waving ? 20 : 9);

      el.body.setAttribute('transform', `translate(0 ${f(motion * breathe * 0.5 - hop * 3)})`);
      el.head.setAttribute('transform', `translate(60 ${f(55 + headY)}) rotate(${f(tilt)}) scale(${f(1 + face.lean * 0.025)})`);
      el.tuft.setAttribute('transform', `rotate(${f(tuft)} 0 -28)`);
      const eyeOpen = f(Math.max(0.05, face.eyeOpen * blink));
      el.eyeL.setAttribute('transform', `translate(-12 -1) scale(1 ${eyeOpen})`);
      el.eyeR.setAttribute('transform', `translate(12 -1) scale(1 ${eyeOpen})`);
      const look = `translate(${f(clamp1(face.lookX) * 2.6)} ${f(clamp1(face.lookY) * 2.8)})`;
      el.pupilL.setAttribute('transform', look);
      el.pupilR.setAttribute('transform', look);
      const lid = `translate(0 ${f(-face.lowerLid * 9)})`;
      el.lidL.setAttribute('transform', lid);
      el.lidR.setAttribute('transform', lid);
      el.browL.setAttribute('transform', `translate(-12 ${f(-13 - face.browL)}) rotate(${f(-face.browTilt * 13)})`);
      el.browR.setAttribute('transform', `translate(12 ${f(-13 - face.browR)}) rotate(${f(face.browTilt * 13)})`);
      el.cheeks.setAttribute('opacity', f(face.blush * 0.55));
      el.mouth.setAttribute('transform', `translate(${f(face.mouthX)} 15)`);
      const d = mouthPath(face);
      el.mouthShape.setAttribute('d', d);
      el.mouthClip.setAttribute('d', d);
      el.tongue.setAttribute('opacity', f(Math.max(0, Math.min(1, (face.open - 0.22) * 3))));
      el.mic.setAttribute('opacity', f(mic));
      el.hand.setAttribute('transform', `translate(${f(hand.x)} ${f(hand.y)}) rotate(${f(hand.r)})`);

      const next: Shown = waving ? 'waving' : talking ? 'talking' : expression;
      if (next !== shown) {
        shown = next;
        root.dataset.expression = shown;
        setStatus(STATUS[shown]);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    cheer();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onPointer);
    };
  }, []);

  const skin = `url(#${id}-skin)`;
  return (
    <div className="producer-stage" ref={stage}>
      <button className="producer-character" onClick={cheer} aria-label="Your Producer. Press to say hello.">
        <svg viewBox="0 0 120 120" aria-hidden>
          <defs>
            <linearGradient id={`${id}-skin`} gradientUnits="userSpaceOnUse" x1="0" y1="-30" x2="0" y2="30">
              <stop offset="0" style={{ stopColor: 'var(--pc-skin-1)' }} />
              <stop offset="1" style={{ stopColor: 'var(--pc-skin-2)' }} />
            </linearGradient>
            <clipPath id={`${id}-eye`}>
              <ellipse rx="7.2" ry="8.4" />
            </clipPath>
            <clipPath id={`${id}-mouth`}>
              <path data-part="mouthClip" d={mouthPath(EXPRESSIONS.idle)} />
            </clipPath>
          </defs>

          <g className="pc-thoughts">
            <circle cx="93" cy="31" r="2.2" />
            <circle cx="100" cy="21" r="3.2" />
            <circle cx="109" cy="9" r="4.6" />
          </g>
          <g className="pc-sparkles">
            <path d="M0-4.5 1.1-1.1 4.5 0 1.1 1.1 0 4.5-1.1 1.1-4.5 0-1.1-1.1Z" transform="translate(17 26)" />
            <path d="M0-4.5 1.1-1.1 4.5 0 1.1 1.1 0 4.5-1.1 1.1-4.5 0-1.1-1.1Z" transform="translate(103 30) scale(.8)" />
            <path d="M0-4.5 1.1-1.1 4.5 0 1.1 1.1 0 4.5-1.1 1.1-4.5 0-1.1-1.1Z" transform="translate(99 64) scale(.6)" />
          </g>

          <g data-part="body">
            <rect x="53" y="76" width="14" height="16" rx="5" style={{ fill: 'var(--pc-skin-2)' }} />
            <path className="pc-shirt" d="M29 132C29 104 41 89 60 89s31 15 31 43Z" />
            <path className="pc-trim" d="M47 90q13 10 26 0" />
            <path className="pc-trim pc-trim--thin" d="M55 95l-1 10M65 95l1 10" />
            <g className="pc-badge">
              <line x1="70" y1="106" x2="77" y2="101" />
              <circle cx="70" cy="106" r="2.3" />
              <circle cx="77" cy="101" r="2.3" />
            </g>
          </g>

          <g data-part="head" transform="translate(60 55)">
            <rect x="-31" y="-29" width="62" height="57" rx="27" fill={skin} className="pc-head" />
            <ellipse cx="-11" cy="-18" rx="12" ry="6" className="pc-shine" />
            <path className="pc-band" d="M-33 4C-35-44 35-44 33 4" />
            <g data-part="tuft">
              <path className="pc-hair" d="M-3-27C-10-35-4-46 5-42c-5 1-6 6-2 11 2-4 7-5 8-2-4 0-6 3-7 6Z" />
            </g>

            <path data-part="browL" className="pc-brow" d="M-5.5 1Q0-2.4 5.5 1" />
            <path data-part="browR" className="pc-brow" d="M-5.5 1Q0-2.4 5.5 1" />
            {(['L', 'R'] as const).map((side) => (
              <g key={side} data-part={`eye${side}`} transform={`translate(${side === 'L' ? -12 : 12} -1)`}>
                <g clipPath={`url(#${id}-eye)`}>
                  <ellipse rx="7.2" ry="8.4" className="pc-eye" />
                  <g data-part={`pupil${side}`}>
                    <circle r="4.4" className="pc-pupil" />
                    <circle cx="-1.5" cy="-1.7" r="1.5" className="pc-glint" />
                    <circle cx="1.5" cy="1.5" r=".65" className="pc-glint" opacity=".7" />
                  </g>
                  <ellipse data-part={`lid${side}`} cy="16" rx="10" ry="7.5" fill={skin} />
                </g>
              </g>
            ))}
            <g data-part="cheeks" className="pc-cheeks" opacity=".14">
              <ellipse cx="-20" cy="10" rx="5.5" ry="3.2" />
              <ellipse cx="20" cy="10" rx="5.5" ry="3.2" />
            </g>
            <path className="pc-nose" d="M-1.6 6.2Q0 7.8 1.6 6.2" />
            <g data-part="mouth" transform="translate(0 15)">
              <path data-part="mouthShape" className="pc-mouth" d={mouthPath(EXPRESSIONS.idle)} />
              <g clipPath={`url(#${id}-mouth)`}>
                <ellipse data-part="tongue" cx="0" cy="8.5" rx="5.5" ry="4.2" className="pc-tongue" opacity="0" />
              </g>
            </g>

            <rect x="-39" y="-9" width="10" height="20" rx="4.5" className="pc-gear" />
            <rect x="29" y="-9" width="10" height="20" rx="4.5" className="pc-gear" />
            <rect x="-37.4" y="-4" width="2.2" height="10" rx="1.1" className="pc-light" />
            <rect x="35.2" y="-4" width="2.2" height="10" rx="1.1" className="pc-light" />
            <path className="pc-boom" d="M-34 9C-33 23-24 27-15 24" />
            <rect x="-17.5" y="21" width="7" height="5.4" rx="2.7" className="pc-gear" />
            <circle data-part="mic" cx="-13.9" cy="23.7" r="1.4" className="pc-onair" opacity=".15" />
          </g>

          <g data-part="hand" transform="translate(80 140)">
            <ellipse rx="6.6" ry="7.6" fill={skin} className="pc-hand" />
            <ellipse cx="-5.2" cy="-1.5" rx="2.4" ry="3.6" transform="rotate(-25 -5.2 -1.5)" fill={skin} className="pc-hand" />
          </g>
        </svg>
      </button>
      <div className="producer-stage__text">
        <strong>Producer</strong>
        <span className="producer-stage__status">{status}</span>
      </div>
    </div>
  );
}
