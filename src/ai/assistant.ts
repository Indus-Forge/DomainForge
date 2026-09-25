import { useBoard } from '../store/board';
import { chat, describePicture as privateDescribe, lookAtPictures, type ChatMessage, type PrivateAIStatus } from './privateAI';
import { onlineAsk, onlineChat, onlineDescribe, onlineDraw, onlineJSON, onlineLookJSON, type OnlineAIStatus } from './onlineAI';
import { noteModelUsed } from './models';
import { cleanSvg } from './svg';

/**
 * One assistant, whichever is available.
 *
 * The private assistant (on this computer) always wins. The online assistant
 * is only used when there is no private one, when it exists at all (the
 * claude.ai preview), and when educator mode is off. Every place that shows
 * the assistant's work says which one did it.
 */

export type AssistantKind = 'private' | 'online';

export interface AssistantInfo {
  kind: AssistantKind | null;
  canSeePictures: boolean;
  /** Can draw illustrations (online only: it writes pictures as SVG). */
  canDraw: boolean;
}

export function pickAssistant(privateAI: PrivateAIStatus, onlineAI: OnlineAIStatus, allowOnline: boolean): AssistantInfo {
  if (privateAI.online && privateAI.chatModel) {
    return { kind: 'private', canSeePictures: Boolean(privateAI.visionModel), canDraw: false };
  }
  if (onlineAI.available && allowOnline) return { kind: 'online', canSeePictures: onlineAI.canSeePictures, canDraw: true };
  return { kind: null, canSeePictures: false, canDraw: false };
}

/** React hook: what the current assistant can do. */
export function useAssistant(): AssistantInfo {
  const privateAI = useBoard((s) => s.privateAI);
  const onlineAI = useBoard((s) => s.onlineAI);
  const allowOnline = useBoard((s) => !s.settings.educatorMode);
  return pickAssistant(privateAI, onlineAI, allowOnline);
}

function current() {
  const { privateAI, onlineAI, settings, learn } = useBoard.getState();
  const info = pickAssistant(privateAI, onlineAI, !settings.educatorMode);
  if (info.kind === 'online') learn('online-assistant');
  return { info, privateAI };
}

const NONE = 'No assistant is switched on yet. Open “Your AI” to see how to switch one on.';

export async function* converse(instructions: string, turns: { role: 'user' | 'assistant'; content: string }[]): AsyncGenerator<string> {
  const { info, privateAI } = current();
  if (info.kind === 'private') {
    noteModelUsed(privateAI.chatModel);
    const messages: ChatMessage[] = [{ role: 'system', content: instructions }, ...turns];
    yield* chat(privateAI, messages);
  } else if (info.kind === 'online') {
    yield* onlineChat(instructions, turns);
  } else throw new Error(NONE);
}

/** A single piece of writing: instructions plus the material to work on. */
export async function write(instructions: string, material: string): Promise<string> {
  const { info } = current();
  if (info.kind === 'online') return onlineAsk(instructions, material);
  let out = '';
  for await (const piece of converse(instructions, [{ role: 'user', content: material }])) out += piece;
  return out.trim().replace(/^["“]|["”]$/g, '');
}

/** Asks for structured data. The instructions must describe the JSON wanted. */
export async function writeJSON<T>(instructions: string, material: string): Promise<T> {
  const { info } = current();
  if (info.kind === 'online') return onlineJSON<T>(instructions, material);
  const raw = await write(`${instructions}\nReply with only the JSON, no other text.`, material);
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf('}'), raw.lastIndexOf(']'));
  if (start < 0 || end < start) throw new Error('Your assistant’s answer came back in the wrong shape. Try again.');
  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    throw new Error('Your assistant’s answer came back in the wrong shape. Try again.');
  }
}

const DESCRIBE =
  'Describe this picture in one short sentence for an artist: the main subject, the setting, the colours and the mood. Reply with the sentence only.';

export async function describe(dataUrl: string): Promise<string> {
  const { info, privateAI } = current();
  if (info.kind === 'private') {
    noteModelUsed(privateAI.visionModel);
    return privateDescribe(privateAI, dataUrl);
  }
  if (info.kind === 'online' && info.canSeePictures) return onlineDescribe(DESCRIBE, dataUrl);
  throw new Error('Your assistant can’t look at pictures yet.');
}

export const POLISH =
  'You help people turn their notes into a picture description. Rewrite the notes as one vivid description of a single ' +
  'picture, under 70 words. Keep every idea from the notes. Do not add new characters or objects. Reply with the ' +
  'description only.';

export function polish(description: string): Promise<string> {
  return write(POLISH, description);
}

/** Draws an illustration as SVG (online assistant only). Returns clean SVG markup. */
export async function drawIllustration(description: string, referenceImage?: string): Promise<string> {
  const { info } = current();
  if (!info.canDraw) throw new Error('This assistant can’t draw.');
  const withReference = referenceImage && info.canSeePictures;
  const raw = await onlineDraw(
    'Draw this picture as a single self-contained SVG illustration with viewBox="0 0 768 512". ' +
      'Use a friendly, colourful illustrated style with a full background, clear shapes, gradients and simple shading. ' +
      'Show the scene; do not write the description as text in the picture. ' +
      (withReference ? 'The attached picture is a visual reference: follow its colours, mood and composition. ' : '') +
      'Reply with only the SVG code.\n\nThe picture: ' +
      description,
    referenceImage,
    info.canSeePictures,
  );
  return cleanSvg(raw);
}

/**
 * Asks the assistant to watch the pictures and plan a video edit. Returns the
 * raw plan (checked later by cleanPlan) and a plain description of who planned it.
 */
export async function directVideo(pictures: string[], writing: string): Promise<{ raw: unknown; plannedBy: string }> {
  const { info, privateAI } = current();
  const prompt =
    `You are a film editor making a short video, 10 to 20 seconds long, from ${pictures.length} picture${pictures.length === 1 ? '' : 's'}. ` +
    'Look carefully at each picture. Plan 3 to 5 shots. For each shot choose the picture (a 0-based index), the point the camera ' +
    'should move towards (the most interesting detail, such as a face, eyes, a subject or an action) as x and y from 0 (left, top) ' +
    'to 1 (right, bottom), how far to zoom in by the end (1.2 to 2.0), how long it lasts (2 to 5 seconds), a short caption (under ' +
    '10 words) and why you chose it. Start with a wide shot, then move to closer details. Also write a short title (under 6 words) ' +
    'and a closing line (under 8 words). ' +
    (writing.trim() ? `Base the captions on the person's own words: "${writing.trim().slice(0, 600)}". ` : 'Write captions that describe what is shown. ') +
    'Reply with JSON only, like {"title":"...","shots":[{"picture":0,"focus":{"x":0.5,"y":0.4},"start_zoom":1,"end_zoom":1.5,"seconds":3.5,"caption":"...","why":"..."}],"ending":"..."}';
  if (info.kind === 'private' && info.canSeePictures) {
    noteModelUsed(privateAI.visionModel);
    return { raw: await lookAtPictures(privateAI, prompt, pictures), plannedBy: `your private assistant (${privateAI.visionModel}), which looked at the pictures` };
  }
  if (info.kind === 'online' && info.canSeePictures) {
    return { raw: await onlineLookJSON(prompt, pictures), plannedBy: 'the online assistant (Claude), which looked at the pictures' };
  }
  throw new Error('No assistant here can look at pictures.');
}
