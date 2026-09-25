/**
 * Making pictures.
 *
 * Two ways, chosen automatically:
 *  - A local image studio on this computer (any tool that speaks the common
 *    Stable Diffusion web API, such as AUTOMATIC1111 or Forge).
 *  - Sketch preview: always available, needs nothing installed. It lays out
 *    the recipe as a mood board so the whole flow can be learned before any
 *    AI is set up. It is honestly labelled as a sketch, never passed off as AI.
 */

import { localFetch, placesToLook } from '../platform';

export interface ImageStudioStatus {
  online: boolean;
  baseUrl?: string;
}

export const NO_STUDIO: ImageStudioStatus = { online: false };

const PLACES_TO_LOOK = placesToLook('/local/images', 'http://127.0.0.1:7860');

export async function checkImageStudio(): Promise<ImageStudioStatus> {
  for (const baseUrl of PLACES_TO_LOOK) {
    try {
      const res = await localFetch(`${baseUrl}/sdapi/v1/sd-models`, { signal: AbortSignal.timeout(2500) });
      if (res.ok && Array.isArray(await res.json())) return { online: true, baseUrl };
    } catch {
      // Not running here. Try the next place.
    }
  }
  return NO_STUDIO;
}

export interface MadePicture {
  image: string;
  madeWith: string;
  isSketch: boolean;
}

export async function makePicture(
  studio: ImageStudioStatus,
  description: string,
  referenceImage?: string,
): Promise<MadePicture> {
  if (!studio.online) {
    return { image: await sketch(description, referenceImage), madeWith: 'Sketch preview', isSketch: true };
  }
  const common = {
    prompt: description,
    negative_prompt: 'blurry, distorted, extra limbs, text, watermark',
    steps: 25,
    cfg_scale: 6,
    width: 768,
    height: 512,
  };
  const endpoint = referenceImage ? 'img2img' : 'txt2img';
  const body = referenceImage ? { ...common, init_images: [referenceImage], denoising_strength: 0.65 } : common;
  const res = await localFetch(`${studio.baseUrl}/sdapi/v1/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('The image studio on your computer could not make this picture.');
  const data = (await res.json()) as { images?: string[] };
  const first = data.images?.[0];
  if (!first) throw new Error('The image studio finished without a picture.');
  return {
    image: first.startsWith('data:') ? first : `data:image/png;base64,${first}`,
    madeWith: referenceImage ? 'Image studio on this computer, guided by your picture' : 'Image studio on this computer',
    isSketch: false,
  };
}

// ---------------------------------------------------------------------------
// Sketch preview

const MOODS: [RegExp, [string, string, string]][] = [
  [/futur|neon|cyber|sci-?fi|space|robot/i, ['#1b1f4b', '#5b2a86', '#1fc8c8']],
  [/forest|garden|nature|jungle|leaf|green/i, ['#1f3b2c', '#3f7d4e', '#c8e6a0']],
  [/sunset|warm|desert|autumn|fire|golden/i, ['#4a1d2f', '#d9644a', '#f7c873']],
  [/ocean|sea|beach|water|rain|underwater/i, ['#0f2a47', '#1f6f9c', '#9fe0e8']],
  [/night|dark|moon|mystery|shadow/i, ['#0d1024', '#2b2e5a', '#8a8fd8']],
  [/snow|winter|ice|frost/i, ['#314a63', '#8fb3cf', '#f2f7fb']],
];
const GENTLE: [string, string, string] = ['#3c3553', '#8a6fb0', '#f3d9c4'];

function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
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
  return lines;
}

async function sketch(description: string, referenceImage?: string): Promise<string> {
  const W = 768;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const [deep, mid, light] = MOODS.find(([re]) => re.test(description))?.[1] ?? GENTLE;
  const rand = seeded(description);

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, deep);
  bg.addColorStop(1, mid);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft shapes, different for every description.
  for (let i = 0; i < 9; i++) {
    const x = rand() * W;
    const y = rand() * H * 0.8;
    const r = 40 + rand() * 160;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${light}88`);
    g.addColorStop(1, `${light}00`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // A horizon, so it reads as a scene.
  ctx.fillStyle = `${deep}cc`;
  ctx.beginPath();
  ctx.moveTo(0, H * 0.72);
  for (let x = 0; x <= W; x += 48) ctx.lineTo(x, H * (0.6 + rand() * 0.14));
  ctx.lineTo(W, H);
  ctx.lineTo(0, H);
  ctx.fill();

  if (referenceImage) {
    try {
      const img = await loadImage(referenceImage);
      const size = 190;
      const scale = Math.min(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = W - w - 44;
      const y = 40;
      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(0.04);
      ctx.fillStyle = '#fffdf8';
      ctx.shadowColor = 'rgba(0,0,0,.35)';
      ctx.shadowBlur = 18;
      ctx.fillRect(-w / 2 - 10, -h / 2 - 10, w + 20, h + 36);
      ctx.shadowBlur = 0;
      ctx.drawImage(img, -w / 2, -h / 2, w, h);
      ctx.fillStyle = '#6b6478';
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('your reference', 0, h / 2 + 18);
      ctx.restore();
    } catch {
      // A picture that will not load should not stop the sketch.
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,.9)';
  ctx.font = '700 14px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('SKETCH PREVIEW', 32, 44);

  ctx.font = '500 20px system-ui, sans-serif';
  const lines = wrap(ctx, description || 'An empty idea', W - 112).slice(0, 5);
  const boxH = lines.length * 28 + 32;
  ctx.fillStyle = 'rgba(255,253,248,.92)';
  ctx.beginPath();
  ctx.roundRect(32, H - boxH - 32, W - 64, boxH, 16);
  ctx.fill();
  ctx.fillStyle = '#2d2838';
  lines.forEach((l, i) => ctx.fillText(l, 56, H - boxH - 32 + 42 + i * 28));

  return canvas.toDataURL('image/jpeg', 0.88);
}
