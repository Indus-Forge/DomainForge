/**
 * The Personal AI Assistant: a private language model running on this computer.
 *
 * Today this talks to Ollama. Nothing outside this file should know that, and
 * nothing the person sees should mention it. Another local runtime can be
 * added here without changing the rest of the app.
 */

export interface PrivateAIStatus {
  online: boolean;
  baseUrl?: string;
  models: string[];
  /** The model used for conversation and writing. */
  chatModel?: string;
  /** A model that can look at pictures, if one is installed. */
  visionModel?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const PLACES_TO_LOOK = ['/local/ai', 'http://127.0.0.1:11434'];
const VISION = /llava|vision|moondream|minicpm-v|qwen2\.5-?vl|qwen3-?vl|gemma3|llama4/i;
const NOT_FOR_CHAT = /embed|minilm|bge-|nomic/i;

export const OFFLINE: PrivateAIStatus = { online: false, models: [] };

export async function checkPrivateAI(preferredModel?: string): Promise<PrivateAIStatus> {
  for (const baseUrl of PLACES_TO_LOOK) {
    try {
      const res = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500) });
      if (!res.ok) continue;
      const data = (await res.json()) as { models?: { name: string }[] };
      const models = (data.models ?? []).map((m) => m.name);
      const chatCandidates = models.filter((m) => !NOT_FOR_CHAT.test(m));
      const chatModel =
        (preferredModel && models.includes(preferredModel) && preferredModel) ||
        chatCandidates.find((m) => !VISION.test(m)) ||
        chatCandidates[0];
      return { online: true, baseUrl, models, chatModel, visionModel: models.find((m) => VISION.test(m)) };
    } catch {
      // Not running here. Try the next place.
    }
  }
  return OFFLINE;
}

/** Streams a conversation reply, piece by piece, so people can watch the assistant "think". */
export async function* chat(status: PrivateAIStatus, messages: ChatMessage[], signal?: AbortSignal): AsyncGenerator<string> {
  if (!status.online || !status.chatModel) throw new Error('Your private assistant is not running yet.');
  const res = await fetch(`${status.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: status.chatModel, messages, stream: true }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error('Your private assistant did not answer. It may still be starting up.');

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
      const piece = JSON.parse(line) as { message?: { content?: string }; error?: string };
      if (piece.error) throw new Error(piece.error);
      if (piece.message?.content) yield piece.message.content;
    }
  }
}

async function ask(status: PrivateAIStatus, system: string, prompt: string): Promise<string> {
  let out = '';
  for await (const piece of chat(status, [
    { role: 'system', content: system },
    { role: 'user', content: prompt },
  ])) {
    out += piece;
  }
  return out.trim().replace(/^["“]|["”]$/g, '');
}

/** Rewrites a board description as one flowing sentence or two, without adding or dropping ideas. */
export function polishDescription(status: PrivateAIStatus, description: string): Promise<string> {
  return ask(
    status,
    'You help people turn their notes into a picture description. Rewrite the notes as one vivid description of a single ' +
      'picture, under 70 words. Keep every idea from the notes. Do not add new characters or objects. Reply with the ' +
      'description only.',
    description,
  );
}

/** Looks at a picture and describes it in words, so the description can travel with it into a recipe. */
export async function describePicture(status: PrivateAIStatus, dataUrl: string): Promise<string> {
  if (!status.online || !status.visionModel) throw new Error('Your assistant cannot look at pictures yet.');
  const res = await fetch(`${status.baseUrl}/api/generate`, {
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
