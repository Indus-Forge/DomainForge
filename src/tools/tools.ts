import type { Card, ToolId } from '../model/types';
import { CARD_INFO } from '../model/cards';
import { useBoard } from '../store/board';
import { buildRecipe, gatherConnected, scenesFromText } from '../ai/recipe';
import { directVideo, pickAssistant, write, writeJSON } from '../ai/assistant';
import { enlargePicture } from '../ai/imageEngine';
import { findFreeSpot } from '../store/layout';
import { bringCardsIntoView } from '../canvas/Canvas';
import { autoPlan, cleanPlan, makeVideo, type VideoPlan } from './video';

/**
 * Workflow tiles. Every tile follows the same shape, shown on its face in
 * plain words: it TAKES what is connected to it, DOES one job, and MAKES
 * something new on the board, connected back to the tile.
 */

export interface ToolInfo {
  id: ToolId;
  name: string;
  icon: string;
  takes: string;
  does: string;
  makes: string;
  /** What it needs to work: an assistant, or nothing extra. */
  needsAssistant: boolean;
}

export const TOOLS: Record<ToolId, ToolInfo> = {
  image: {
    id: 'image',
    name: 'Picture Maker',
    icon: '🖼️',
    takes: 'an idea, plus any pictures, characters and styles',
    does: 'turns them into a description and makes a picture',
    makes: 'a new picture',
    needsAssistant: false,
  },
  script: {
    id: 'script',
    name: 'Script Writer',
    icon: '✍️',
    takes: 'ideas, notes and characters',
    does: 'writes a short script with narration and scenes',
    makes: 'a script note',
    needsAssistant: true,
  },
  research: {
    id: 'research',
    name: 'Research Assistant',
    icon: '🔎',
    takes: 'a topic or question',
    does: 'gathers key points and questions worth checking',
    makes: 'research notes',
    needsAssistant: true,
  },
  storyboard: {
    id: 'storyboard',
    name: 'Storyboard Creator',
    icon: '🎞️',
    takes: 'a story or script, plus characters and styles',
    does: 'splits it into scenes, each ready to picture',
    makes: 'a row of scene cards',
    needsAssistant: false,
  },
  enlarge: {
    id: 'enlarge',
    name: 'Picture Enlarger',
    icon: '🔍',
    takes: 'a picture',
    does: 'makes it twice as big',
    makes: 'a bigger picture',
    needsAssistant: false,
  },
  video: {
    id: 'video',
    name: 'Video Maker',
    icon: '🎬',
    takes: 'pictures, plus a note or script for captions',
    does: 'moves a camera slowly across each picture and adds captions',
    makes: 'a short video (made on your computer, no AI)',
    needsAssistant: false,
  },
  voice: {
    id: 'voice',
    name: 'Voice',
    icon: '🗣️',
    takes: 'a note, script or idea',
    does: 'reads it aloud with your computer’s voice',
    makes: 'sound (nothing is saved)',
    needsAssistant: false,
  },
};

export const TOOL_ORDER: ToolId[] = ['image', 'video', 'script', 'research', 'storyboard', 'enlarge', 'voice'];

/** The cards directly or nearly connected to a tile (not its own results). */
export function toolInputs(toolId: string): Card[] {
  return gatherConnected(useBoard.getState().project, toolId)
    .slice(1)
    .map((v) => v.card)
    .filter((c) => c.kind !== 'tool');
}

function words(cards: Card[]): string {
  return cards
    .map((c) => {
      const name = CARD_INFO[c.kind].name;
      const text = [c.title, c.text].filter(Boolean).join(': ');
      return text ? `${name}: ${text}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

/** Places a result card beside the tile and connects it back with a "made" link. */
function placeResult(tool: Card, patch: Partial<Card> & { kind: Card['kind'] }): string {
  const { project } = useBoard.getState();
  const info = CARD_INFO[patch.kind];
  const w = patch.w ?? info.w;
  const h = patch.h ?? info.h;
  const spot = findFreeSpot(project.cards, w, h, [
    { x: tool.x + tool.w + 90, y: tool.y + tool.h / 2 - h / 2 },
    { x: tool.x + tool.w / 2 - w / 2, y: tool.y + tool.h + 90 },
  ]);
  const id = useBoard.getState().addCard(patch.kind, { x: spot.x + w / 2, y: spot.y + h / 2 }, { ...patch, w, h }, { exact: true });
  linkOrigin(tool.id, id);
  return id;
}

function linkOrigin(from: string, to: string) {
  const s = useBoard.getState();
  s.updateProjectLinks((links) => [...links, { id: crypto.randomUUID(), from, to, label: 'made', kind: 'origin' }]);
}

function textFrom(inputs: Card[], kinds: Card['kind'][]): string {
  return inputs
    .filter((c) => kinds.includes(c.kind))
    .map((c) => c.text.trim())
    .filter(Boolean)
    .join('\n');
}

export class ToolProblem extends Error {}

/** Runs a tile. Returns a short plain sentence describing what happened. */
export async function runTool(toolCardId: string, onProgress?: (words: string) => void): Promise<string> {
  const state = useBoard.getState();
  const tool = state.project.cards.find((c) => c.id === toolCardId);
  if (!tool?.tool) throw new ToolProblem('This tile has lost track of which tool it is.');
  const info = TOOLS[tool.tool];
  const inputs = toolInputs(tool.id);
  const assistant = pickAssistant(state.privateAI, state.onlineAI, !state.settings.educatorMode);
  if (info.needsAssistant && !assistant.kind) {
    throw new ToolProblem('This tool needs an assistant. Open “Your AI” to switch one on.');
  }
  state.learn('tool-used');
  const madeBy = `Made by the ${info.name} from ${inputs.length} connected card${inputs.length === 1 ? '' : 's'}`;

  switch (tool.tool) {
    case 'image': {
      const recipe = buildRecipe(state.project, tool.id);
      if (!recipe.description) throw new ToolProblem('Connect an idea or a note to this tile first.');
      state.openRecipe({ cardId: tool.id, mode: 'preview' });
      return 'Check the recipe, then press Create.';
    }

    case 'script': {
      const material = words(inputs);
      if (!material) throw new ToolProblem('Connect an idea or some notes to write about.');
      const script = await write(
        'You are a friendly script writer. Using the material below, write a short script (under 220 words) for a video ' +
          'or presentation. Use a few numbered scenes. For each scene give one line of what we SEE and one line of NARRATION. ' +
          'Keep the language simple and warm. Use every character and idea given; invent nothing important. Plain text only.',
        material,
      );
      const id = placeResult(tool, { kind: 'note', title: 'Script', text: script, w: 320, h: 360, madeBy });
      bringCardsIntoView([id]);
      return 'Your script is on the board.';
    }

    case 'research': {
      const topic = words(inputs);
      if (!topic) throw new ToolProblem('Connect an idea or a question to research.');
      const notes = await write(
        'You are a careful research helper for a beginner. For the topic below, write: "Key points:" with 5 short bullet ' +
          'points, then "Worth checking:" with 3 questions the person should verify in a trusted source. Say plainly when ' +
          'something is uncertain or disputed. Keep it under 200 words. Plain text.',
        topic,
      );
      const id = placeResult(tool, { kind: 'note', title: 'Research notes', text: notes, w: 320, h: 340, madeBy });
      state.learn('check-facts');
      bringCardsIntoView([id]);
      return 'Research notes are on the board. Check the important facts yourself.';
    }

    case 'storyboard': {
      const story = textFrom(inputs, ['idea', 'note']);
      if (!story) throw new ToolProblem('Connect a story, idea or script to split into scenes.');
      let scenes: { title: string; description: string }[];
      let how = 'split into scenes by your assistant';
      if (assistant.kind) {
        const data = await writeJSON<{ scenes?: { title?: string; description?: string }[] }>(
          'Split this story into 4 to 6 scenes for a storyboard. For each scene give a short title and a one-sentence ' +
            'visual description of what the picture shows. Reply with JSON like {"scenes":[{"title":"...","description":"..."}]}.',
          story,
        );
        scenes = (data.scenes ?? [])
          .map((sc, i) => ({ title: String(sc.title ?? `Scene ${i + 1}`), description: String(sc.description ?? '') }))
          .filter((sc) => sc.description)
          .slice(0, 6);
      } else {
        scenes = scenesFromText(story);
        how = 'split one sentence per scene (no assistant needed)';
      }
      if (!scenes.length) throw new ToolProblem('There wasn’t enough story to split into scenes.');
      const ids = placeScenes(tool, scenes, inputs, `Made by the Storyboard Creator, ${how}`);
      state.learn('storyboard-made');
      bringCardsIntoView(ids);
      return `${scenes.length} scenes are on the board. Click one and press “Make a picture”.`;
    }

    case 'enlarge': {
      const picture = inputs.find((c) => (c.kind === 'picture' || c.kind === 'creation') && c.image);
      if (!picture?.image) throw new ToolProblem('Connect a picture to enlarge.');
      const result = await enlargePicture(state.studio, picture.image);
      const w = Math.min(420, picture.w * 1.4);
      const id = placeResult(tool, {
        kind: 'picture',
        image: result.image,
        text: picture.text,
        w,
        h: Math.round(picture.h * (w / picture.w)),
        madeBy: result.how,
      });
      state.learn('enlarged');
      bringCardsIntoView([id]);
      return result.ai ? 'Enlarged with AI.' : 'Enlarged by stretching. Set up an image studio for AI enlarging.';
    }

    case 'video': {
      const pictures = inputs
        .filter((c) => (c.kind === 'picture' || c.kind === 'creation') && c.image)
        .slice(0, 6)
        .map((c) => ({ image: c.image!, caption: c.text.trim() }));
      if (!pictures.length) throw new ToolProblem('Connect at least one picture to make a video.');
      const writing = textFrom(inputs, ['idea', 'note']);
      const sentences = scenesFromText(writing).map((sc) => sc.description);
      let plan: VideoPlan = autoPlan(pictures, sentences);
      let note = '';
      if (assistant.canSeePictures) {
        onProgress?.('Your assistant is watching the pictures and planning the edit…');
        try {
          const { raw, plannedBy } = await directVideo(pictures.map((p) => p.image), writing);
          plan = cleanPlan(raw, pictures.length, plannedBy) ?? plan;
          if (plan.plannedBy !== plannedBy) note = ' (the assistant’s plan didn’t make sense, so the automatic editor stepped in)';
        } catch (err) {
          note = ` (${(err as Error).message} The automatic editor stepped in.)`;
        }
      }
      const made = await makeVideo(
        pictures.map((p) => p.image),
        plan,
        (f) => onProgress?.(`Recording the edit… ${Math.round(f * 100)}%`),
      );
      const id = placeResult(tool, {
        kind: 'video',
        video: made.url,
        videoInfo: { pictures: pictures.length, seconds: made.seconds, format: made.format, plan, poster: made.poster },
        madeBy: `Edit planned by ${plan.plannedBy}. Camera moves, captions and cuts rendered on this computer.`,
        w: 380,
        h: 300,
      });
      state.learn('video-made');
      if (!plan.plannedBy.startsWith('the automatic editor')) state.learn('video-directed');
      bringCardsIntoView([id]);
      return `Your ${Math.round(made.seconds)}-second video is on the board${note}.`;
    }

    case 'voice': {
      const text = textFrom(inputs, ['note', 'idea', 'character']);
      if (!text) throw new ToolProblem('Connect a note or idea to read aloud.');
      if (!('speechSynthesis' in window)) throw new ToolProblem('This computer doesn’t offer a built-in voice here.');
      speak(text);
      state.learn('voice');
      return 'Reading aloud…';
    }
  }
}

export function speak(text: string) {
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.replace(/^[-•*]\s*/gm, ''));
  utterance.rate = 0.95;
  speechSynthesis.speak(utterance);
}

export function stopSpeaking() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

/** Lays scenes out in a row, chained with "then", each connected to the characters and styles that were connected to the tile. */
function placeScenes(tool: Card, scenes: { title: string; description: string }[], inputs: Card[], madeBy: string): string[] {
  const info = CARD_INFO.idea;
  const gap = 50;
  const total = scenes.length * info.w + (scenes.length - 1) * gap;
  const { project } = useBoard.getState();
  const origin = findFreeSpot(project.cards, total, info.h + 60, [
    { x: tool.x, y: tool.y + tool.h + 110 },
    { x: tool.x + tool.w + 100, y: tool.y },
  ]);
  const { addCard, updateProjectLinks } = useBoard.getState();
  const ids = scenes.map((sc, i) =>
    addCard(
      'idea',
      { x: origin.x + i * (info.w + gap) + info.w / 2, y: origin.y + info.h / 2 + (i % 2 ? 30 : 0) },
      { title: sc.title, text: sc.description, madeBy },
      { exact: true },
    ),
  );
  const shared = inputs.filter((c) => c.kind === 'character' || c.kind === 'style');
  updateProjectLinks((links) => [
    ...links,
    { id: crypto.randomUUID(), from: tool.id, to: ids[0], label: 'made', kind: 'origin' as const },
    ...ids.slice(1).map((id, i) => ({ id: crypto.randomUUID(), from: ids[i], to: id, label: 'then' })),
    ...ids.flatMap((id) =>
      shared.map((c) => ({
        id: crypto.randomUUID(),
        from: id,
        to: c.id,
        label: c.kind === 'style' ? 'in the style of' : 'features',
      })),
    ),
  ]);
  useBoard.getState().select(null);
  return ids;
}

/** Adds a tool tile to the board. */
export function addTool(tool: ToolId, at: { x: number; y: number }) {
  bringCardsIntoView([useBoard.getState().addCard('tool', at, { tool })]);
}
