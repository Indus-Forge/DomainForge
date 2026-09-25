/**
 * The Video Maker: turns pictures into a short video on this computer.
 *
 * No AI is involved. A virtual camera slowly zooms and pans across each
 * picture (the "Ken Burns" effect), pictures cross-fade, and captions appear
 * along the bottom. The browser records the result as a real video file.
 */

export interface VideoShot {
  image: string;
  caption?: string;
}

export interface MadeVideo {
  url: string;
  blob: Blob;
  seconds: number;
  format: 'mp4' | 'webm';
}

const W = 1280;
const H = 720;
const FPS = 30;
const SHOT_SECONDS = 3.5;
const FADE_SECONDS = 0.7;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('One of the pictures could not be opened.'));
    img.src = src;
  });
}

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

/** How long a video of this many pictures lasts. Short enough to share, long enough to see. */
export function videoSeconds(pictures: number): number {
  return Math.max(5, pictures * SHOT_SECONDS);
}

/**
 * Where the camera is at a moment in a shot: zoom from 1 to 1.18, drifting
 * in a direction that alternates between shots so the video feels alive.
 */
export function cameraAt(shot: number, t: number): { zoom: number; dx: number; dy: number } {
  const ease = t * t * (3 - 2 * t);
  const directions = [
    [1, 0.4],
    [-1, 0.2],
    [0.5, -1],
    [-0.6, -0.5],
  ];
  const [x, y] = directions[shot % directions.length];
  return { zoom: 1 + 0.18 * ease, dx: x * 0.06 * ease, dy: y * 0.06 * ease };
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, shot: number, t: number, alpha: number) {
  const { zoom, dx, dy } = cameraAt(shot, t);
  const scale = Math.max(W / img.width, H / img.height) * zoom;
  const w = img.width * scale;
  const h = img.height * scale;
  // The zoom always leaves more margin than the drift uses, so the picture never shows an edge.
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (W - w) / 2 + dx * W, (H - h) / 2 + dy * H, w, h);
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

/** Draws one frame of the video at time `time` (seconds). Exported so it can be previewed or tested. */
export function drawFrame(ctx: CanvasRenderingContext2D, images: HTMLImageElement[], shots: VideoShot[], time: number) {
  const total = videoSeconds(shots.length);
  const per = total / shots.length;
  const index = Math.min(shots.length - 1, Math.floor(time / per));
  const local = time - index * per;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  drawCover(ctx, images[index], index, (local + (index ? FADE_SECONDS : 0)) / (per + FADE_SECONDS), 1);
  const next = index + 1;
  const fading = next < shots.length && local > per - FADE_SECONDS;
  if (fading) {
    const into = local - (per - FADE_SECONDS);
    drawCover(ctx, images[next], next, into / (per + FADE_SECONDS), into / FADE_SECONDS);
  }
  const captionIn = Math.min(1, local / 0.5);
  const captionOut = fading ? 1 - (local - (per - FADE_SECONDS)) / FADE_SECONDS : 1;
  drawCaption(ctx, shots[index].caption ?? '', Math.min(captionIn, captionOut));
  // Gentle fade in from and out to black at the very start and end.
  const edge = Math.min(time / 0.5, (total - time) / 0.6, 1);
  if (edge < 1) {
    ctx.globalAlpha = 1 - Math.max(0, edge);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
}

/** Records the video in real time. `onProgress` gets 0 to 1. */
export async function makeVideo(shots: VideoShot[], onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<MadeVideo> {
  if (!shots.length) throw new Error('Connect at least one picture.');
  const format = videoFormat();
  if (!format) throw new Error('This computer can’t record video here. Try the Workshop desktop app or a recent Chrome or Edge.');
  const images = await Promise.all(shots.map((s) => loadImage(s.image)));
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const seconds = videoSeconds(shots.length);

  drawFrame(ctx, images, shots, 0);
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: format.mimeType, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((resolve) => (recorder.onstop = () => resolve()));

  recorder.start(250);
  const start = performance.now();
  await new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (signal?.aborted) return reject(new Error('Stopped.'));
      const time = (performance.now() - start) / 1000;
      drawFrame(ctx, images, shots, Math.min(time, seconds));
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

  const blob = new Blob(chunks, { type: format.mimeType.split(';')[0] });
  const url = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(blob);
  });
  return { url, blob, seconds, format: format.format };
}
