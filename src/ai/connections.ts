/**
 * What is connected, and what isn't: one row per thing the Workshop can do
 * with AI, saying what powers it now or what it needs. The Admin dashboard
 * and its counter are built from this.
 */

import { ASSISTANT_NAMES, pickFrom } from './assistant';
import { PICTURE_MAKER_NAMES, pictureMakerFrom } from './create';
import { pickSearch, SEARCH_NAMES } from './search';
import type { useBoard } from '../store/board';

export type AdminSection = 'ollama' | 'local' | 'huggingface' | 'studio' | 'voice' | 'search';

export interface Capability {
  id: 'chat' | 'vision' | 'pictures' | 'voice' | 'search' | 'enlarge';
  name: string;
  /** What in the app it powers. */
  powers: string;
  ready: boolean;
  /** Ready, and working through a service on the internet. */
  online: boolean;
  /** What powers it now, or what happens without it. */
  now: string;
  /** What to connect, when it isn't ready. */
  need: string;
  /** Where in Admin to connect it. */
  section: AdminSection;
}

type State = Pick<
  ReturnType<typeof useBoard.getState>,
  'privateAI' | 'onlineAI' | 'localAI' | 'hf' | 'studio' | 'voice' | 'search' | 'settings'
>;

export function connectionReport(s: State): Capability[] {
  const c = s.settings.connections;
  const assistant = pickFrom({ ...s, connections: c, educatorMode: s.settings.educatorMode });
  const maker = pictureMakerFrom(s);
  const search = pickSearch(s.search, c.tavilyKey, s.settings.educatorMode);
  const name = assistant.kind ? ASSISTANT_NAMES[assistant.kind] : '';
  return [
    {
      id: 'chat',
      name: 'Chat & writing',
      powers: 'Producer chat, Script Writer, Research, Storyboard, smoothing wording',
      ready: Boolean(assistant.kind),
      online: Boolean(assistant.kind) && !assistant.isPrivate,
      now: assistant.kind ? `Using ${name}` : 'Not connected: the Producer can only suggest plans',
      need: 'Ollama with a chat model (a cloud model like gemma3:27b-cloud needs no graphics card), or a Hugging Face token',
      section: 'ollama',
    },
    {
      id: 'vision',
      name: 'Reading pictures',
      powers: 'Describe on picture cards, AI-directed Video Maker edits',
      ready: assistant.canSeePictures,
      online: assistant.canSeePictures && !assistant.isPrivate,
      now: assistant.canSeePictures ? `Using ${name}` : assistant.kind ? `${name} can’t see pictures` : 'Not connected',
      need: 'A vision model: qwen2.5vl or gemma3 in Ollama, or Qwen VL on Hugging Face',
      section: 'ollama',
    },
    {
      id: 'pictures',
      name: 'Making pictures',
      powers: 'Create picture, the Picture Maker tool',
      ready: maker !== null,
      online: maker === 'huggingface',
      now: maker ? `Using ${PICTURE_MAKER_NAMES[maker]}` : 'Not connected: no pictures can be made',
      need: 'A free Hugging Face token, or an image studio (Forge) on this computer',
      section: 'huggingface',
    },
    {
      id: 'voice',
      name: 'AI voice',
      powers: 'The Voice tool, with a recording you can save',
      ready: s.voice.online,
      online: false,
      now: s.voice.online ? `Using the voice server at ${s.voice.baseUrl}` : 'Not connected: the computer’s built-in voice is used instead',
      need: 'A speech server on this computer, such as Kokoro-FastAPI (free, no graphics card needed)',
      section: 'voice',
    },
    {
      id: 'search',
      name: 'Web research',
      powers: 'The Research tool, with real sources',
      ready: search !== null,
      online: search === 'tavily',
      now: search ? `Using ${SEARCH_NAMES[search]}` : 'Not connected: research comes from the assistant’s memory, without sources',
      need: 'Your own SearXNG server, or a free Tavily key',
      section: 'search',
    },
    {
      id: 'enlarge',
      name: 'AI enlarging',
      powers: 'The Enlarge tool',
      ready: s.studio.online,
      online: false,
      now: s.studio.online ? 'Using the image studio’s upscaler' : 'Not connected: pictures are stretched, not enlarged by AI',
      need: 'An image studio (Forge or AUTOMATIC1111) on this computer',
      section: 'studio',
    },
  ];
}
