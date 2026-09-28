/**
 * AI voices: a speech server on this computer that speaks the common
 * OpenAI-style speech interface (POST /v1/audio/speech). Kokoro-FastAPI is
 * free and runs on an ordinary computer; LocalAI and openedai-speech work too.
 * Without one, the Voice tool uses the computer's built-in voice and says so.
 */

import { localFetch } from '../platform';
import { trimBase } from './openaiCompat';

export interface VoiceStatus {
  online: boolean;
  baseUrl?: string;
  /** Voice names the server offers, when it lists them. */
  voices: string[];
}

export const NO_VOICE: VoiceStatus = { online: false, voices: [] };
export const DEFAULT_VOICE_URL = 'http://127.0.0.1:8880/v1';
export const DEFAULT_VOICE_MODEL = 'kokoro';
export const DEFAULT_VOICE_NAME = 'af_heart';

/** Reads a voice list in the shapes speech servers use: ["a", "b"], {voices: [...]}, or [{id|name}]. */
export function voiceNames(data: unknown): string[] {
  const list = Array.isArray(data) ? data : (data as { voices?: unknown })?.voices;
  if (!Array.isArray(list)) return [];
  return list
    .map((v) => (typeof v === 'string' ? v : String((v as { id?: string; name?: string })?.id ?? (v as { name?: string })?.name ?? '')))
    .filter(Boolean);
}

export async function checkVoice(customUrl: string): Promise<VoiceStatus> {
  const baseUrl = trimBase(customUrl || DEFAULT_VOICE_URL);
  try {
    const res = await localFetch(`${baseUrl}/audio/voices`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) return { online: true, baseUrl, voices: voiceNames(await res.json()) };
    // Servers without a voice list still answer the model list.
    const models = await localFetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(2500) });
    if (models.ok) return { online: true, baseUrl, voices: [] };
  } catch {
    // Nothing running there.
  }
  return NO_VOICE;
}

/** Reads text aloud with the AI voice. Returns the recording. */
export async function speakWithAI(status: VoiceStatus, model: string, voice: string, text: string): Promise<Blob> {
  if (!status.online || !status.baseUrl) throw new Error('No AI voice is connected. Connect one in Admin.');
  const res = await localFetch(`${status.baseUrl}/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || DEFAULT_VOICE_MODEL, voice: voice || DEFAULT_VOICE_NAME, input: text, response_format: 'mp3' }),
  });
  if (!res.ok) throw new Error('The voice server couldn’t read this aloud. Check the voice name in Admin.');
  const blob = await res.blob();
  if (blob.size < 200) throw new Error('The voice server sent back an empty recording.');
  return blob.type.startsWith('audio/') ? blob : new Blob([blob], { type: 'audio/mpeg' });
}
