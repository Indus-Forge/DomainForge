import { useBoard, type Connections, type LocalServerStatus } from '../store/board';
import { chat, describePicture as privateDescribe, isCloudModel, lookAtPictures, type ChatMessage, type PrivateAIStatus } from './privateAI';
import { onlineAsk, onlineChat, onlineDescribe, onlineDraw, onlineJSON, onlineLookJSON, type OnlineAIStatus } from './onlineAI';
import { ocAnswer, ocStream, parseJSONReply, withPictures, type OCServer } from './openaiCompat';
import { HF_ROUTER, type HFStatus } from './huggingface';
import { noteModelUsed } from './models';
import { cleanSvg } from './svg';

/**
 * One assistant, whichever the person chose in the AI Hub.
 *
 * On "auto", private AI always wins: Ollama first, then a local model server.
 * Online services (Hugging Face, and the claude.ai preview's assistant) are
 * only used when nothing private is available, and never in educator mode.
 * Every place that shows the assistant's work says which one did it.
 */

export type AssistantKind = 'private' | 'local' | 'huggingface' | 'online';

export interface AssistantInfo {
  kind: AssistantKind | null;
  canSeePictures: boolean;
  /** Can draw illustrations (the preview's online assistant writes pictures as SVG). */
  canDraw: boolean;
  /** Runs on this computer. */
  isPrivate: boolean;
}

export interface AISources {
  privateAI: PrivateAIStatus;
  onlineAI: OnlineAIStatus;
  localAI: LocalServerStatus;
  hf: HFStatus;
  connections: Connections;
  educatorMode: boolean;
}

export const ASSISTANT_NAMES: Record<AssistantKind, string> = {
  private: 'Ollama',
  local: 'your local model server',
  huggingface: 'Hugging Face (online)',
  online: 'the online assistant (Claude)',
};

function describeKind(kind: AssistantKind, s: AISources): AssistantInfo {
  switch (kind) {
    case 'private': {
      const vision = s.privateAI.visionModel;
      return {
        kind,
        canSeePictures: Boolean(vision) && (!isCloudModel(vision) || !s.educatorMode),
        canDraw: false,
        isPrivate: !isCloudModel(s.privateAI.chatModel),
      };
    }
    case 'local':
      return { kind, canSeePictures: s.connections.localVision, canDraw: false, isPrivate: true };
    case 'huggingface':
      return { kind, canSeePictures: Boolean(s.connections.hfVisionModel), canDraw: false, isPrivate: false };
    case 'online':
      return { kind, canSeePictures: s.onlineAI.canSeePictures, canDraw: true, isPrivate: false };
  }
}

export function available(kind: AssistantKind, s: AISources): boolean {
  const onlineAllowed = !s.educatorMode;
  switch (kind) {
    case 'private':
      // Ollama cloud models run online, so educator mode keeps them off.
      return s.privateAI.online && Boolean(s.privateAI.chatModel) && (onlineAllowed || !isCloudModel(s.privateAI.chatModel));
    case 'local':
      return s.localAI.online && Boolean(s.connections.localModel);
    case 'huggingface':
      return onlineAllowed && s.hf.connected && Boolean(s.connections.hfToken);
    case 'online':
      return onlineAllowed && s.onlineAI.available;
  }
}

const NONE: AssistantInfo = { kind: null, canSeePictures: false, canDraw: false, isPrivate: false };

export function pickFrom(s: AISources): AssistantInfo {
  const route = s.connections.chatWith;
  if (route !== 'auto') return available(route, s) ? describeKind(route, s) : NONE;
  const order: AssistantKind[] = ['private', 'local', 'huggingface', 'online'];
  const kind = order.find((k) => available(k, s));
  return kind ? describeKind(kind, s) : NONE;
}

function sources(): AISources {
  const { privateAI, onlineAI, localAI, hf, settings } = useBoard.getState();
  return { privateAI, onlineAI, localAI, hf, connections: settings.connections, educatorMode: settings.educatorMode };
}

/** Kept for callers that pass statuses directly. */
export function pickAssistant(privateAI: PrivateAIStatus, onlineAI: OnlineAIStatus, allowOnline: boolean): AssistantInfo {
  return pickFrom({ ...sources(), privateAI, onlineAI, educatorMode: !allowOnline });
}

/** React hook: what the current assistant can do. */
export function useAssistant(): AssistantInfo {
  const privateAI = useBoard((s) => s.privateAI);
  const onlineAI = useBoard((s) => s.onlineAI);
  const localAI = useBoard((s) => s.localAI);
  const hf = useBoard((s) => s.hf);
  const connections = useBoard((s) => s.settings.connections);
  const educatorMode = useBoard((s) => s.settings.educatorMode);
  return pickFrom({ privateAI, onlineAI, localAI, hf, connections, educatorMode });
}

function current() {
  const s = sources();
  const info = pickFrom(s);
  if (info.kind && !info.isPrivate) useBoard.getState().learn('online-assistant');
  return { info, s };
}

function server(kind: 'local' | 'huggingface', s: AISources, vision = false): OCServer {
  if (kind === 'local') return { baseUrl: s.connections.localUrl, model: s.connections.localModel };
  return {
    baseUrl: HF_ROUTER,
    apiKey: s.connections.hfToken,
    model: vision ? s.connections.hfVisionModel : s.connections.hfChatModel,
  };
}

const NO_ASSISTANT = 'No assistant is switched on yet. Open the AI Hub to connect one.';

export async function* converse(instructions: string, turns: { role: 'user' | 'assistant'; content: string }[]): AsyncGenerator<string> {
  const { info, s } = current();
  switch (info.kind) {
    case 'private': {
      noteModelUsed(s.privateAI.chatModel);
      const messages: ChatMessage[] = [{ role: 'system', content: instructions }, ...turns];
      yield* chat(s.privateAI, messages);
      return;
    }
    case 'local':
    case 'huggingface':
      yield* ocStream(server(info.kind, s), [{ role: 'system', content: instructions }, ...turns], ASSISTANT_NAMES[info.kind]);
      return;
    case 'online':
      yield* onlineChat(instructions, turns);
      return;
    default:
      throw new Error(NO_ASSISTANT);
  }
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
  return parseJSONReply<T>(await write(`${instructions}\nReply with only the JSON, no other text.`, material));
}

const DESCRIBE =
  'Describe this picture in one short sentence for an artist: the main subject, the setting, the colours and the mood. Reply with the sentence only.';

export async function describe(dataUrl: string): Promise<string> {
  const { info, s } = current();
  if (!info.canSeePictures) throw new Error('Your assistant can’t look at pictures yet.');
  switch (info.kind) {
    case 'private':
      noteModelUsed(s.privateAI.visionModel);
      return privateDescribe(s.privateAI, dataUrl);
    case 'local':
    case 'huggingface':
      return ocAnswer(server(info.kind, s, true), [withPictures(DESCRIBE, [dataUrl])], ASSISTANT_NAMES[info.kind]);
    case 'online':
      return onlineDescribe(DESCRIBE, dataUrl);
    default:
      throw new Error(NO_ASSISTANT);
  }
}

export const POLISH =
  'You help people turn their notes into a picture description. Rewrite the notes as one vivid description of a single ' +
  'picture, under 70 words. Keep every idea from the notes. Do not add new characters or objects. Reply with the ' +
  'description only.';

export function polish(description: string): Promise<string> {
  return write(POLISH, description);
}

/** Draws an illustration as SVG (the preview's online assistant only). Returns clean SVG markup. */
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
  const { info, s } = current();
  const prompt =
    `You are a film editor making a short video, 10 to 20 seconds long, from ${pictures.length} picture${pictures.length === 1 ? '' : 's'}. ` +
    'Look carefully at each picture. Plan 3 to 5 shots. For each shot choose the picture (a 0-based index), the point the camera ' +
    'should move towards (the most interesting detail, such as a face, eyes, a subject or an action) as x and y from 0 (left, top) ' +
    'to 1 (right, bottom), how far to zoom in by the end (1.2 to 2.0), how long it lasts (2 to 5 seconds), a short caption (under ' +
    '10 words) and why you chose it. Start with a wide shot, then move to closer details. Also write a short title (under 6 words) ' +
    'and a closing line (under 8 words). ' +
    (writing.trim() ? `Base the captions on the person's own words: "${writing.trim().slice(0, 600)}". ` : 'Write captions that describe what is shown. ') +
    'Reply with JSON only, like {"title":"...","shots":[{"picture":0,"focus":{"x":0.5,"y":0.4},"start_zoom":1,"end_zoom":1.5,"seconds":3.5,"caption":"...","why":"..."}],"ending":"..."}';
  if (!info.canSeePictures) throw new Error('No assistant here can look at pictures.');
  switch (info.kind) {
    case 'private':
      noteModelUsed(s.privateAI.visionModel);
      return {
        raw: await lookAtPictures(s.privateAI, prompt, pictures),
        plannedBy: `${isCloudModel(s.privateAI.visionModel) ? 'Ollama cloud (online)' : 'your private assistant'} (${s.privateAI.visionModel}), which looked at the pictures`,
      };
    case 'local':
    case 'huggingface': {
      const answer = await ocAnswer(server(info.kind, s, true), [withPictures(prompt, pictures)], ASSISTANT_NAMES[info.kind]);
      const model = info.kind === 'local' ? s.connections.localModel : s.connections.hfVisionModel;
      return { raw: parseJSONReply(answer), plannedBy: `${ASSISTANT_NAMES[info.kind]} (${model}), which looked at the pictures` };
    }
    case 'online':
      return { raw: await onlineLookJSON(prompt, pictures), plannedBy: 'the online assistant (Claude), which looked at the pictures' };
    default:
      throw new Error(NO_ASSISTANT);
  }
}
