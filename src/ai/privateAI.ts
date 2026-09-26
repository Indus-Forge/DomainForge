/**
 * The Personal AI Assistant: a private language model running on this computer.
 *
 * Today this talks to Ollama. Nothing outside this file should know that, and
 * nothing the person sees should mention it. Another local runtime can be
 * added here without changing the rest of the app.
 */

import { localFetch, placesToLook } from '../platform';
import type { InstalledModel } from './models';

export interface PrivateAIStatus {
  online: boolean;
  baseUrl?: string;
  models: string[];
  /** The model used for conversation and writing. */
  chatModel?: string;
  /** A model that can look at pictures, if one is installed. */
  visionModel?: string;
  /** Everything installed, with sizes, for the Model Library. */
  installed: InstalledModel[];
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const PLACES_TO_LOOK = placesToLook('/local/ai', 'http://127.0.0.1:11434');
const VISION = /llava|vision|moondream|minicpm-v|qwen2\.5-?vl|qwen3-?vl|gemma3|gemma4|llama4|mistral-small3/i;
const NOT_FOR_CHAT = /embed|minilm|bge-|nomic/i;

export const OFFLINE: PrivateAIStatus = { online: false, models: [], installed: [] };

/**
 * Ollama cloud models (names ending in "-cloud" or ":cloud", e.g. gpt-oss:120b-cloud)
 * are listed by the Ollama app like any other model, but they run on Ollama's
 * servers. Workshop treats them as online.
 */
export function isCloudModel(name: string | undefined): boolean {
  return Boolean(name && /(?:[-:]cloud)(?::|$)/i.test(name.trim()));
}

export async function checkPrivateAI(preferredModel?: string, customUrl?: string, preferredVision?: string): Promise<PrivateAIStatus> {
  const places = customUrl?.trim() ? [customUrl.trim().replace(/\/+$/, '')] : PLACES_TO_LOOK;
  for (const baseUrl of places) {
    try {
      const res = await localFetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;
      const data = (await res.json()) as { models?: { name: string; size?: number; modified_at?: string }[] };
      const models = (data.models ?? []).map((m) => m.name);
      const installed = (data.models ?? []).map((m) => ({
        id: m.name,
        sizeGB: (m.size ?? 0) / 1e9,
        installedAt: m.modified_at ? Date.parse(m.modified_at) : undefined,
      }));
      const chatCandidates = models.filter((m) => !NOT_FOR_CHAT.test(m));
      const local = (m: string) => !isCloudModel(m);
      // Automatic choice: a model on this computer first; cloud models only if nothing local is installed.
      const chatModel =
        (preferredModel && models.includes(preferredModel) && preferredModel) ||
        chatCandidates.find((m) => local(m) && !VISION.test(m)) ||
        chatCandidates.find(local) ||
        chatCandidates[0];
      // For pictures: Qwen's vision model on this computer first, then any local vision model, then cloud.
      const visionCandidates = models.filter((m) => VISION.test(m));
      const visionModel =
        (preferredVision && models.includes(preferredVision) && preferredVision) ||
        visionCandidates.find((m) => local(m) && /qwen.*vl/i.test(m)) ||
        visionCandidates.find(local) ||
        visionCandidates[0];
      return { online: true, baseUrl, models, installed, chatModel, visionModel };
    } catch {
      // Not running here. Try the next place.
    }
  }
  return OFFLINE;
}

/** Streams a conversation reply, piece by piece, so people can watch the assistant "think". */
export async function* chat(status: PrivateAIStatus, messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
  if (!status.online || !status.chatModel) throw new Error('Your private assistant is not running yet.');
  const res = await localFetch(`${status.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: status.chatModel, messages, stream: true }),
    signal,
  });
  if (!res.ok) throw new Error('Your private assistant did not answer. It may still be starting up.');

  const read = (line: string) => {
    const piece = JSON.parse(line) as { message?: { content?: string }; error?: string };
    if (piece.error) throw new Error(piece.error);
    return piece.message?.content ?? '';
  };
  if (!res.body) {
    // No streaming available: show the whole reply at once.
    for (const line of (await res.text()).split('\n')) if (line.trim()) yield read(line);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const content = read(line);
      if (content) yield content;
    }
  }
}

/** Looks at a picture and describes it in words, so the description can travel with it into a recipe. */
export async function describePicture(status: PrivateAIStatus, dataUrl: string): Promise<string> {
  if (!status.online || !status.visionModel) throw new Error('Your assistant cannot look at pictures yet.');
  const res = await localFetch(`${status.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: status.visionModel,
      prompt:
        'Describe this picture in one short sentence for an artist: the main subject, the setting, the colours and the mood. ' +
        'Reply with the sentence only.',
      images: [dataUrl.replace(/^data:[^,]+,/, '')],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error('Your assistant could not look at this picture.');
  const data = (await res.json()) as { response?: string };
  return (data.response ?? '').trim();
}

/** Downloads a tool into the private AI runtime, reporting progress from 0 to 1. */
export async function installModel(status: PrivateAIStatus, id: string, onProgress: (fraction: number | null, words: string) => void) {
  if (!status.online) throw new Error('Your private assistant is not running yet.');
  const res = await localFetch(`${status.baseUrl}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: id, stream: true }),
  });
  if (!res.ok) throw new Error('The download couldn’t start. Check your internet connection and try again.');
  const handle = (line: string) => {
    const p = JSON.parse(line) as { status?: string; total?: number; completed?: number; error?: string };
    if (p.error) throw new Error(`The download stopped: ${p.error}`);
    const fraction = p.total && p.completed !== undefined ? p.completed / p.total : null;
    const words = p.status?.startsWith('pulling') ? 'Downloading…' : p.status === 'success' ? 'Installed' : 'Getting ready…';
    onProgress(fraction, words);
  };
  if (!res.body) {
    for (const line of (await res.text()).split('\n')) if (line.trim()) handle(line);
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) handle(line);
  }
  if (buffer.trim()) handle(buffer);
}

/** Removes an installed tool. Only ever called after the person has said yes. */
export async function removeModel(status: PrivateAIStatus, id: string): Promise<void> {
  const res = await localFetch(`${status.baseUrl}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: id }),
  });
  if (!res.ok) throw new Error('That tool couldn’t be removed. It may be in use; try again in a moment.');
}

/** Shows pictures to the vision model and asks for a JSON answer. */
export async function lookAtPictures(status: PrivateAIStatus, prompt: string, dataUrls: string[]): Promise<unknown> {
  if (!status.online || !status.visionModel) throw new Error('Your assistant can’t look at pictures yet.');
  const res = await localFetch(`${status.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: status.visionModel,
      messages: [{ role: 'user', content: prompt, images: dataUrls.map((d) => d.replace(/^data:[^,]+,/, '')) }],
      stream: false,
      format: 'json',
      options: { temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error('Your assistant couldn’t look at the pictures.');
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content ?? '';
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    throw new Error('Your assistant’s plan came back in the wrong shape. Try again.');
  }
}
