/**
 * The Video Maker: turns pictures into a short edited video on this computer.
 *
 * A video is an edit plan: a title, a list of shots and a closing line. Each
 * shot says which picture to use, where the camera looks (a point in the
 * picture) and how far it pushes in. The plan can come from the automatic
 * editor below or from an AI "director" that looked at the pictures; either
 * way it is shown to the person, and this file renders it the same way:
 * camera moves, cross-fades, captions, title and closing cards. The browser
 * records the result as a real video file.
 */

import fixWebmDuration from 'fix-webm-duration';

/** Where the camera looks: a point in the picture (0 to 1 across and down) and how far it is zoomed in (1 = whole frame). */
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export interface VideoShot {
  /** Which of the pictures this shot uses. */
  picture: number;
  caption: string;
  from: Camera;
  to: Camera;
  seconds: number;
  /** Why the director chose this shot (shown to the person). */
  why?: string;
}

export interface VideoPlan {
  title: string;
  shots: VideoShot[];
  ending: string;
  /** Who planned the edit, in plain words. */
  plannedBy: string;
}

export interface MadeVideo {
  url: string;
  blob: Blob;
  seconds: number;
  format: 'mp4' | 'webm';
  /** A still from the video, shown before it plays. */
  poster: string;
}

const W = 1280;
const H = 720;
const FPS = 30;
const FADE = 0.7;
const CARD_SECONDS = 2.4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// ---------------------------------------------------------------------------
// Planning

/**
 * The automatic editor: one shot per sentence (or per picture), alternating
 * gentle camera moves. Used when no assistant can look at the pictures.
 */
export function autoPlan(pictures: { caption: string }[], sentences: string[], title = ''): VideoPlan {
  const count = Math.min(6, Math.max(pictures.length, sentences.length));
  const drifts: [number, number][] = [
    [0.62, 0.45],
    [0.38, 0.5],
    [0.5, 0.35],
    [0.45, 0.62],
  ];
  const shots = Array.from({ length: count }, (_, i): VideoShot => {
    const picture = i % Math.max(1, pictures.length);
    const [x, y] = drifts[i % drifts.length];
    return {
      picture,
      caption: sentences[i] ?? (sentences.length ? '' : pictures[picture]?.caption ?? ''),
      from: { x: 0.5, y: 0.5, zoom: 1 },
      to: { x, y, zoom: 1.2 },
      seconds: 3.5,
    };
  });
  return { title, shots, ending: '', plannedBy: 'the automatic editor (no AI): gentle camera moves, one shot per sentence' };
}

/**
 * Checks and tidies a plan written by an AI director. Anything missing or out
 * of range is corrected rather than trusted.
 */
export function cleanPlan(raw: unknown, pictureCount: number, plannedBy: string): VideoPlan | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const text = (v: unknown, max = 90) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || fallback);
  const cam = (v: unknown, zoom: number): Camera => {
    const c = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>;
    return { x: clamp(num(c.x, 0.5), 0, 1), y: clamp(num(c.y, 0.5), 0, 1), zoom: clamp(num(c.zoom, zoom), 1, 2.5) };
  };
  const shots = (Array.isArray(r.shots) ? r.shots : [])
    .slice(0, 8)
    .map((s): VideoShot | null => {
      if (!s || typeof s !== 'object') return null;
      const o = s as Record<string, unknown>;
      const focus = cam(o.focus, 1.4);
      const startZoom = clamp(num(o.start_zoom, 1), 1, 2);
      const endZoom = clamp(num(o.end_zoom, focus.zoom), 1, 2.5);
      return {
        picture: clamp(Math.round(num(o.picture, 0)), 0, Math.max(0, pictureCount - 1)),
        caption: text(o.caption),
        from: { x: 0.5 + (focus.x - 0.5) * 0.3, y: 0.5 + (focus.y - 0.5) * 0.3, zoom: startZoom },
        to: { x: focus.x, y: focus.y, zoom: endZoom },
        seconds: clamp(num(o.seconds, 3.5), 2, 6),
        why: text(o.why, 160) || undefined,
      };
    })
    .filter((s): s is VideoShot => s !== null);
  if (!shots.length) return null;
  return { title: text(r.title, 60), shots, ending: text(r.ending, 80), plannedBy };
}

/** Total length of a plan, including title and closing cards. */
export function planSeconds(plan: VideoPlan): number {
  const shots = plan.shots.reduce((sum, s) => sum + s.seconds, 0);
  return (plan.title ? CARD_SECONDS : 0) + shots + (plan.ending ? CARD_SECONDS : 0);
}

// ---------------------------------------------------------------------------
// Drawing

type Segment =
  | { kind: 'title' | 'ending'; start: number; seconds: number; text: string; picture: number; camera: Camera }
  | { kind: 'shot'; start: number; seconds: number; shot: VideoShot };

function timeline(plan: VideoPlan): Segment[] {
  const segments: Segment[] = [];
  let t = 0;
  const first = plan.shots[0];
  const last = plan.shots[plan.shots.length - 1];
  if (plan.title) {
    segments.push({ kind: 'title', start: t, seconds: CARD_SECONDS, text: plan.title, picture: first.picture, camera: first.from });
    t += CARD_SECONDS;
  }
  for (const shot of plan.shots) {
    segments.push({ kind: 'shot', start: t, seconds: shot.seconds, shot });
    t += shot.seconds;
  }
  if (plan.ending) segments.push({ kind: 'ending', start: t, seconds: CARD_SECONDS, text: plan.ending, picture: last.picture, camera: last.to });
  return segments;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('One of the pictures could not be opened.'));
    img.src = src;
  });
}

const ease = (t: number) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};

function mix(a: Camera, b: Camera, t: number): Camera {
  const e = ease(t);
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e, zoom: a.zoom + (b.zoom - a.zoom) * e };
}

/** Draws a picture as the camera sees it. The view never leaves the picture, so no edges show. */
function drawCamera(ctx: CanvasRenderingContext2D, img: HTMLImageElement, cam: Camera, alpha: number) {
  const scale = Math.max(W / img.width, H / img.height) * Math.max(1, cam.zoom);
  const viewW = W / scale;
  const viewH = H / scale;
  const cx = clamp(cam.x * img.width, viewW / 2, img.width - viewW / 2);
  const cy = clamp(cam.y * img.height, viewH / 2, img.height - viewH / 2);
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, W / 2 - cx * scale, H / 2 - cy * scale, img.width * scale, img.height * scale);
  ctx.globalAlpha = 1;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, alpha: number) {
  if (!text || alpha <= 0) return;
  ctx.font = '600 38px system-ui, -apple-system, "Segoe UI", sans-serif';
  const lines = wrap(ctx, text, W - 240);
  const lineH = 50;
  const boxH = lines.length * lineH + 36;
  const boxW = Math.min(W - 160, Math.max(...lines.map((l) => ctx.measureText(l).width)) + 72);
  const x = (W - boxW) / 2;
  const y = H - boxH - 56;
  ctx.globalAlpha = alpha * 0.82;
  ctx.fillStyle = '#1f1b2b';
  ctx.beginPath();
  ctx.roundRect(x, y, boxW, boxH, 22);
  ctx.fill();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fffdf9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y + 18 + i * lineH));
  ctx.globalAlpha = 1;
}

function drawCard(ctx: CanvasRenderingContext2D, text: string, big: boolean, alpha: number) {
  ctx.globalAlpha = 0.58 * alpha;
  ctx.fillStyle = '#120f1c';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fffdf9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${big ? 700 : 600} ${big ? 72 : 50}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const lines = wrap(ctx, text, W - 260);
  const lineH = big ? 84 : 62;
  lines.forEach((l, i) => ctx.fillText(l, W / 2, H / 2 + (i - (lines.length - 1) / 2) * lineH));
  ctx.globalAlpha = 1;
}

function drawSegment(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], seg: Segment, time: number, alpha: number) {
  const local = (time - seg.start) / (seg.seconds + FADE);
  if (seg.kind === 'shot') {
    drawCamera(ctx, images[seg.shot.picture], mix(seg.shot.from, seg.shot.to, local), alpha);
    return;
  }
  const drift = seg.kind === 'title' ? { ...seg.camera, zoom: seg.camera.zoom * 1.04 } : { ...seg.camera, zoom: seg.camera.zoom * 1.06 };
  drawCamera(ctx, images[seg.picture], mix(seg.camera, drift, local), alpha);
  const textIn = clamp((time - seg.start - 0.2) / 0.6, 0, 1);
  drawCard(ctx, seg.text, seg.kind === 'title', alpha * textIn);
}

/** Draws one frame at `time` seconds. */
export function drawFrame(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], plan: VideoPlan, time: number) {
  const segments = timeline(plan);
  const total = planSeconds(plan);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const i = Math.max(0, segments.findIndex((s) => time < s.start + s.seconds));
  const seg = segments[i] ?? segments[segments.length - 1];
  drawSegment(ctx, images, seg, time, 1);
  const next = segments[i + 1];
  const into = time - (seg.start + seg.seconds - FADE);
  const fading = next && into > 0;
  if (fading) drawSegment(ctx, images, next, time, into / FADE);
  if (seg.kind === 'shot') {
    const captionIn = clamp((time - seg.start) / 0.5, 0, 1);
    drawCaption(ctx, seg.shot.caption, Math.min(captionIn, fading ? 1 - into / FADE : 1));
  }
  // Fade in from black at the start and out to black at the end.
  const edge = Math.min(time / 0.6, (total - time) / 0.8, 1);
  if (edge < 1) {
    ctx.globalAlpha = 1 - Math.max(0, edge);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

// ---------------------------------------------------------------------------
// Recording

/** The best format this computer can record. */
export function videoFormat(): { mimeType: string; format: 'mp4' | 'webm' } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  // H.264 MP4 plays almost everywhere (phones, QuickTime, Windows). If this computer can't
  // record it, save WebM under its own name rather than an MP4 that some players can't open.
  const options: [string, 'mp4' | 'webm'][] = [
    ['video/mp4;codecs=avc1.42E01F', 'mp4'],
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/webm;codecs=vp9', 'webm'],
    ['video/webm;codecs=vp8', 'webm'],
    ['video/webm', 'webm'],
    ['video/mp4', 'mp4'],
  ];
  const found = options.find(([type]) => MediaRecorder.isTypeSupported(type));
  return found ? { mimeType: found[0], format: found[1] } : null;
}

/** Records the plan in real time. `onProgress` gets 0 to 1. */
export async function makeVideo(
  pictures: string[],
  plan: VideoPlan,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<MadeVideo> {
  if (!plan.shots.length) throw new Error('Connect at least one picture.');
  const format = videoFormat();
  if (!format) throw new Error('This computer can’t record video here. Try the Workshop desktop app or a recent Chrome or Edge.');
  const images = await Promise.all(pictures.map(loadImage));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const seconds = planSeconds(plan);

  // The cover image: a moment from the first shot (after any title card).
  drawFrame(ctx, images, plan, (plan.title ? CARD_SECONDS : 0) + Math.min(1.5, plan.shots[0].seconds / 2));
  const poster = canvas.toDataURL('image/jpeg', 0.8);

  drawFrame(ctx, images, plan, 0);
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  recorder.start(250);
  const start = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (signal?.aborted) return reject(new Error('Stopped.'));
      const time = (performance.now() - start) / 1000;
      drawFrame(ctx, images, plan, Math.min(time, seconds));
      onProgress?.(Math.min(1, time / seconds));
      if (time >= seconds) resolve();
      else if (document.hidden) setTimeout(tick, 1000 / FPS);
      else requestAnimationFrame(tick);
    };
    tick();
  }).finally(() => {
    recorder.stop();
    stream.getTracks().forEach((t) => t.stop());
  });
  await stopped;

  let blob = new Blob(chunks, { type: format.mimeType.split(';')[0] });
  // Browsers record WebM without its length, so players can't show a timeline. Add it.
  if (format.format === 'webm') {
    blob = await fixWebmDuration(blob, seconds * 1000, { logger: false });
  }
  const url = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  return { url, blob, seconds, format: format.format, poster };
}
