/**
 * A small client for the "OpenAI-compatible" chat interface.
 *
 * Many AI services speak it: Hugging Face's router, and local model servers
 * such as LM Studio, llama.cpp's server, Jan, vLLM and Ollama's /v1 route.
 * One client lets people plug in any of them.
 */

import { localFetch } from '../platform';

export type Part = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface OCMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | Part[];
}

export interface OCServer {
  /** Base address ending in /v1, e.g. http://127.0.0.1:1234/v1 */
  baseUrl: string;
  apiKey?: string;
  model: string;
}

function headers(server: OCServer): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (server.apiKey) h.Authorization = `Bearer ${server.apiKey}`;
  return h;
}

export const trimBase = (url: string) => url.trim().replace(/\/+$/, '');

async function problem(res: Response, who: string): Promise<Error> {
  let detail = '';
  try {
    const body = (await res.json()) as { error?: string | { message?: string } };
    detail = typeof body.error === 'string' ? body.error : body.error?.message ?? '';
  } catch {
    // No readable detail.
  }
  if (res.status === 401 || res.status === 403) return new Error(`${who} didn’t accept the access token. Check it in the AI Hub.`);
  if (res.status === 404) return new Error(`${who} doesn’t know that model. Pick another in the AI Hub.`);
  if (res.status === 429) return new Error(`${who} is busy or your free allowance is used up. Try again later.`);
  if (res.status === 503) return new Error(`${who}’s model is waking up. Try again in a minute.`);
  return new Error(`${who} couldn’t answer${detail ? `: ${detail}` : '.'}`);
}

/** Reads a server-sent-events body and yields the text pieces of each chunk. */
export function* parseSSE(text: string): Generator<string> {
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('data:')) continue;
    const data = trimmed.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      const chunk = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
      const piece = chunk.choices?.[0]?.delta?.content;
      if (piece) yield piece;
    } catch {
      // Ignore keep-alive or partial lines.
    }
  }
}

/** Streams a chat reply piece by piece. */
export async function* ocStream(server: OCServer, messages: OCMessage[], who: string, signal?: AbortSignal): AsyncGenerator<string> {
  const res = await localFetch(`${trimBase(server.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: headers(server),
    body: JSON.stringify({ model: server.model, messages, stream: true, max_tokens: 1200 }),
    signal,
  });
  if (!res.ok) throw await problem(res, who);
  if (!res.body) {
    yield* parseSSE(await res.text());
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const cut = buffer.lastIndexOf('\n');
    if (cut < 0) continue;
    yield* parseSSE(buffer.slice(0, cut));
    buffer = buffer.slice(cut + 1);
  }
  if (buffer) yield* parseSSE(buffer);
}

/** One complete answer (no streaming). */
export async function ocAnswer(server: OCServer, messages: OCMessage[], who: string): Promise<string> {
  const res = await localFetch(`${trimBase(server.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: headers(server),
    body: JSON.stringify({ model: server.model, messages, stream: false, max_tokens: 1200 }),
  });
  if (!res.ok) throw await problem(res, who);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? '').trim();
}

/** Shows pictures along with the question. */
export function withPictures(text: string, dataUrls: string[]): OCMessage {
  return { role: 'user', content: [{ type: 'text', text }, ...dataUrls.map((url): Part => ({ type: 'image_url', image_url: { url } }))] };
}

/** Lists the models a server offers (used to check a local server is there). */
export async function ocModels(baseUrl: string, apiKey?: string): Promise<string[]> {
  const res = await localFetch(`${trimBase(baseUrl)}/models`, {
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error('No answer');
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id);
}

/** Pulls the first JSON object or array out of a reply. */
export function parseJSONReply<T>(raw: string): T {
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('The answer came back in the wrong shape. Try again.');
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    throw new Error('The answer came back in the wrong shape. Try again.');
  }
}
