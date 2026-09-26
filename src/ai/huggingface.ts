/**
 * Hugging Face: an online service, reached with the person's own free access
 * token. Used for pictures (text-to-image models such as FLUX) and, if chosen,
 * for chat and reading pictures (Qwen models). Always labelled as online, and
 * never used in educator mode.
 */

import { localFetch } from '../platform';

export const HF_ROUTER = 'https://router.huggingface.co/v1';

export const HF_PICTURE_MODELS = [
  { id: 'black-forest-labs/FLUX.1-schnell', name: 'FLUX.1 schnell', about: 'Fast, good all-rounder' },
  { id: 'stabilityai/stable-diffusion-xl-base-1.0', name: 'Stable Diffusion XL', about: 'Classic, many styles' },
  { id: 'black-forest-labs/FLUX.1-dev', name: 'FLUX.1 dev', about: 'Higher quality, slower' },
];

export const HF_CHAT_MODELS = [
  { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B', about: 'Strong writer and planner' },
  { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B', about: 'Good all-rounder' },
  { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B', about: 'Quick and light' },
];

export const HF_VISION_MODELS = [
  { id: 'Qwen/Qwen2.5-VL-7B-Instruct', name: 'Qwen 2.5 VL 7B', about: 'Reads pictures, plans video edits' },
  { id: 'Qwen/Qwen2.5-VL-72B-Instruct', name: 'Qwen 2.5 VL 72B', about: 'Best at reading pictures, slower' },
];

export interface HFStatus {
  connected: boolean;
  /** The account name the token belongs to. */
  name?: string;
  error?: string;
}

export const HF_NONE: HFStatus = { connected: false };

/** Checks the token and says whose it is. */
export async function checkHuggingFace(token: string): Promise<HFStatus> {
  if (!token.trim()) return HF_NONE;
  try {
    const res = await localFetch('https://huggingface.co/api/whoami-v2', {
      headers: { Authorization: `Bearer ${token.trim()}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.status === 401) return { connected: false, error: 'Hugging Face didn’t accept that token.' };
    if (!res.ok) return { connected: false, error: 'Hugging Face didn’t answer. Check your internet connection.' };
    const data = (await res.json()) as { name?: string };
    return { connected: true, name: data.name };
  } catch {
    return { connected: false, error: 'Couldn’t reach Hugging Face. Check your internet connection.' };
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('The picture couldn’t be read.'));
    reader.readAsDataURL(blob);
  });
}

/** Makes a picture with a Hugging Face text-to-image model. */
export async function hfPicture(token: string, model: string, description: string): Promise<string> {
  const res = await localFetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token.trim()}`, 'Content-Type': 'application/json', Accept: 'image/png' },
    body: JSON.stringify({ inputs: description }),
  });
  if (res.status === 401 || res.status === 403) throw new Error('Hugging Face didn’t accept your access token. Check it in the AI Hub.');
  if (res.status === 402 || res.status === 429) throw new Error('Your free Hugging Face allowance is used up for now. Try again later, or use a local image studio.');
  if (res.status === 503) throw new Error('The picture model is waking up. Try again in a minute.');
  if (!res.ok) throw new Error('Hugging Face couldn’t make this picture. Try another picture model in the AI Hub.');
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) throw new Error('Hugging Face sent back something that isn’t a picture.');
  return blobToDataUrl(blob);
}
