/**
 * Making pictures with a local image studio on this computer: any tool that
 * speaks the common Stable Diffusion web API, such as AUTOMATIC1111 or Forge.
 * There is no fallback that fakes a picture.
 */

import { localFetch, placesToLook } from '../platform';

export interface ImageStudioStatus {
  online: boolean;
  baseUrl?: string;
}

export const NO_STUDIO: ImageStudioStatus = { online: false };

const PLACES_TO_LOOK = placesToLook('/local/images', 'http://127.0.0.1:7860');

export async function checkImageStudio(customUrl?: string): Promise<ImageStudioStatus> {
  const places = customUrl?.trim() ? [customUrl.trim().replace(/\/+$/, '')] : PLACES_TO_LOOK;
  for (const baseUrl of places) {
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
  how: 'studio';
}

export async function makePicture(
  studio: ImageStudioStatus,
  description: string,
  referenceImage?: string,
): Promise<MadePicture> {
  if (!studio.online) {
    throw new Error('The image studio on this computer isn’t running. Start it, or connect Hugging Face in Admin.');
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
    how: 'studio',
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

/**
 * Makes a picture bigger. With an image studio, its AI upscaler invents new
 * detail; without one, the picture is smoothly stretched (and says so).
 */
export async function enlargePicture(studio: ImageStudioStatus, image: string): Promise<{ image: string; how: string; ai: boolean }> {
  if (studio.online) {
    try {
      const res = await localFetch(`${studio.baseUrl}/sdapi/v1/extra-single-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, upscaling_resize: 2, upscaler_1: 'R-ESRGAN 4x+' }),
      });
      if (res.ok) {
        const data = (await res.json()) as { image?: string };
        if (data.image) {
          return {
            image: data.image.startsWith('data:') ? data.image : `data:image/png;base64,${data.image}`,
            how: 'Enlarged by the image studio’s AI upscaler, which adds new detail',
            ai: true,
          };
        }
      }
    } catch {
      // Fall back to simple enlarging below.
    }
  }
  const img = await loadImage(image);
  const scale = Math.min(2, 2048 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { image: canvas.toDataURL('image/jpeg', 0.92), how: 'Enlarged by smooth stretching (no AI, no new detail)', ai: false };
}
