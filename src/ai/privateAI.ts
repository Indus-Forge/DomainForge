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
  /** Reached over the internet (Ollama's own servers, with an API key): every model runs online. */
  hosted?: boolean;
  /** The person's ollama.com API key, sent only to Ollama's servers. */
  apiKey?: string;
  /** Why Ollama's servers didn't connect, in plain words. */
  problem?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const PLACES_TO_LOOK = placesToLook('/local/ai', 'http://127.0.0.1:11434');
/** Ollama's own servers: cloud models without the Ollama app, with an API key from ollama.com. */
export const OLLAMA_CLOUD = 'https://ollama.com';
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

/** Whether a model sends words to the internet: every model on Ollama's servers, and cloud models in the Ollama app. */
export function runsOnline(status: Pick<PrivateAIStatus, 'hosted'>, model: string | undefined): boolean {
  return Boolean(model) && (Boolean(status.hosted) || isCloudModel(model));
}

/** An address on this computer (or the dev server's path to one), rather than a server on the internet. */
function onThisComputer(baseUrl: string): boolean {
  if (baseUrl.startsWith('/')) return true;
  try {
    return ['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseUrl).hostname);
  } catch {
    return true;
  }
}

/** The API key is for Ollama's servers only: it is never sent anywhere else. */
function isOllamaCloud(baseUrl: string): boolean {
  try {
    return new URL(baseUrl).hostname === new URL(OLLAMA_CLOUD).hostname;
  } catch {
    return false;
  }
}

function headers(status: Pick<PrivateAIStatus, 'apiKey'>, json = true): Record<string, string> {
  const h: Record<string, string> = json ? { 'Content-Type': 'application/json' } : {};
  if (status.apiKey) h.Authorization = `Bearer ${status.apiKey}`;
  return h;
}

/** Turns a failed reply into plain words. */
async function problemWith(res: Response, status: PrivateAIStatus, fallback: string): Promise<Error> {
  if (status.hosted && (res.status === 401 || res.status === 403)) return new Error('Ollama didn’t accept your API key. Check it in Admin.');
  if (status.hosted && res.status === 429) return new Error('Your Ollama cloud allowance is used up for now. Try again later.');
  let detail = '';
  try {
    detail = ((await res.json()) as { error?: string }).error ?? '';
  } catch {
    // No details given.
  }
  return new Error(detail ? `${fallback} (${detail})` : fallback);
}

/**
 * Finds Ollama: the app on this computer first, then, if the person gave an
 * API key, Ollama's own servers. A custom address is the only place looked.
 */
export async function checkPrivateAI(preferredModel?: string, customUrl?: string, preferredVision?: string, apiKey?: string): Promise<PrivateAIStatus> {
  const key = apiKey?.trim() || undefined;
  const places = customUrl?.trim() ? [customUrl.trim().replace(/\/+$/, '')] : [...PLACES_TO_LOOK, ...(key ? [OLLAMA_CLOUD] : [])];
  let problem: string | undefined;
  for (const baseUrl of places) {
    const hosted = !onThisComputer(baseUrl);
    const sendKey = key && isOllamaCloud(baseUrl) ? key : undefined;
    try {
      const res = await localFetch(`${baseUrl}/api/tags`, { headers: headers({ apiKey: sendKey }, false), signal: AbortSignal.timeout(hosted ? 8000 : 2500) });
      if (hosted && (res.status === 401 || res.status === 403)) {
        problem = sendKey ? 'Ollama didn’t accept that API key.' : 'Ollama’s servers need your API key.';
        continue;
      }
      if (!res.ok) continue;
      const data = (await res.json()) as { models?: { name: string; size?: number; modified_at?: string }[] };
      const models = (data.models ?? []).map((m) => m.name);
      const installed = (data.models ?? []).map((m) => ({
        id: m.name,
        sizeGB: (m.size ?? 0) / 1e9,
        installedAt: m.modified_at ? Date.parse(m.modified_at) : undefined,
      }));
      const chatCandidates = models.filter((m) => !NOT_FOR_CHAT.test(m));
      const local = (m: string) => !runsOnline({ hosted }, m);
      // Ollama's servers list cloud models without the "-cloud" the Ollama app adds, so a choice made there still matches.
      const find = (wanted?: string) =>
        wanted ? (models.includes(wanted) ? wanted : hosted ? models.find((m) => m === wanted.replace(/[-:]cloud$/i, '')) : undefined) : undefined;
      // Automatic choice: a model on this computer first; cloud models only if nothing local is installed.
      const chatModel =
        find(preferredModel) ||
        chatCandidates.find((m) => local(m) && !VISION.test(m)) ||
        chatCandidates.find(local) ||
        chatCandidates[0];
      // For pictures: Qwen's vision model on this computer first, then any local vision model, then cloud.
      const visionCandidates = models.filter((m) => VISION.test(m));
      const visionModel =
        find(preferredVision) ||
        visionCandidates.find((m) => local(m) && /qwen.*vl/i.test(m)) ||
        visionCandidates.find(local) ||
        visionCandidates[0];
      return { online: true, baseUrl, models, installed, chatModel, visionModel, ...(hosted ? { hosted, apiKey: sendKey } : {}) };
    } catch {
      // Not running here. Try the next place.
      if (hosted) problem ??= 'Couldn’t reach Ollama’s servers. Check your internet connection.';
    }
  }
  return problem ? { ...OFFLINE, problem } : OFFLINE;
}

/** Streams a conversation reply, piece by piece, so people can watch the assistant "think". */
export async function* chat(status: PrivateAIStatus, messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
  if (!status.online || !status.chatModel) throw new Error('Your private assistant is not running yet.');
  const res = await localFetch(`${status.baseUrl}/api/chat`, {
    method: 'POST',
    headers: headers(status),
    body: JSON.stringify({ model: status.chatModel, messages, stream: true }),
    signal,
  });
  if (!res.ok) throw await problemWith(res, status, status.hosted ? 'Ollama’s servers didn’t answer.' : 'Your private assistant did not answer. It may still be starting up.');

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
    headers: headers(status),
    body: JSON.stringify({
      model: status.visionModel,
      prompt:
        'Describe this picture in one short sentence for an artist: the main subject, the setting, the colours and the mood. ' +
        'Reply with the sentence only.',
      images: [dataUrl.replace(/^data:[^,]+,/, '')],
      stream: false,
    }),
  });
  if (!res.ok) throw await problemWith(res, status, 'Your assistant could not look at this picture.');
  const data = (await res.json()) as { response?: string };
  return (data.response ?? '').trim();
}

/** Downloads a tool into the private AI runtime, reporting progress from 0 to 1. */
export async function installModel(status: PrivateAIStatus, id: string, onProgress: (fraction: number | null, words: string) => void) {
  if (!status.online) throw new Error('Your private assistant is not running yet.');
  if (status.hosted) throw new Error('Models on Ollama’s servers are ready to use: there’s nothing to download.');
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
  if (status.hosted) throw new Error('Models on Ollama’s servers can’t be removed from here.');
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
    headers: headers(status),
    body: JSON.stringify({
      model: status.visionModel,
      messages: [{ role: 'user', content: prompt, images: dataUrls.map((d) => d.replace(/^data:[^,]+,/, '')) }],
      stream: false,
      format: 'json',
      options: { temperature: 0.4 },
    }),
  });
  if (!res.ok) throw await problemWith(res, status, 'Your assistant couldn’t look at the pictures.');
  const data = (await res.json()) as { message?: { content?: string } };
  const text = data.message?.content ?? '';
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  } catch {
    throw new Error('Your assistant’s plan came back in the wrong shape. Try again.');
  }
}
