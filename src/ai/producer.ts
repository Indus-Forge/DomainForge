import type { CardKind, ToolId } from '../model/types';

/**
 * The Producer: a calm project partner that helps people break big ideas into
 * steps they can see on the board.
 *
 * Plans are written by people, not generated, so they are dependable and
 * available even when no AI is running. The private assistant adds
 * conversation on top when it is switched on.
 */

export interface PlanStep {
  kind: CardKind;
  title: string;
  hint: string;
  why: string;
  /** For tool steps: which tool. */
  tool?: ToolId;
  /** How this step connects to the main idea (the first step). No link means it stands alone. */
  link?: string;
}

export interface Plan {
  id: string;
  what: string;
  steps: PlanStep[];
}

const step = (kind: CardKind, title: string, hint: string, why: string, link?: string): PlanStep => ({ kind, title, hint, why, link });
const tool = (id: ToolId, title: string, why: string): PlanStep => ({ kind: 'tool', tool: id, title, hint: '', why, link: 'related to' });

/*
 * Every plan is a small mind map: the main idea in the middle, and each step
 * connected to it with words that say how it helps. Because the connections
 * are real, filling the cards in changes what the AI reads.
 */
const PLANS: { match: RegExp; plan: Plan }[] = [
  {
    match: /documentar/i,
    plan: {
      id: 'documentary',
      what: 'a documentary',
      steps: [
        step('idea', 'The story', 'What is your documentary about, in one sentence?', 'Everything else grows from this.'),
        tool('research', 'Research', 'Good documentaries start with what is true. Run it to gather facts to check.'),
        step('picture', 'References', 'Drop in photos of places, people or objects.', 'Pictures keep the look of your film consistent.', 'looks like'),
        tool('script', 'Narration', 'The Script Writer turns your story into scenes and narration.'),
        tool('storyboard', 'Scenes', 'The Storyboard Creator splits the story into scenes you can picture one by one.'),
      ],
    },
  },
  {
    match: /comic|story|book|fairy ?tale|novel/i,
    plan: {
      id: 'story',
      what: 'a story',
      steps: [
        step('idea', 'The story', 'What happens, in one sentence?', 'A clear idea guides every picture.'),
        step('character', 'Main character', 'Who is it about? What do they look like?', 'Describing a character once keeps them the same in every scene.', 'features'),
        step('note', 'Setting', 'Where and when does it happen?', 'A setting gives every scene a shared world.', 'takes place in'),
        step('style', 'Look and feel', 'Cartoon, painted, pencil…?', 'One style makes the pages feel like a single book.', 'in the style of'),
        tool('storyboard', 'Scenes', 'Small steps are easier to create than one big leap. Each scene keeps your character and style.'),
      ],
    },
  },
  {
    match: /poster|flyer|advert|leaflet|banner|logo/i,
    plan: {
      id: 'poster',
      what: 'a poster',
      steps: [
        step('idea', 'The message', 'What should people remember?', 'A poster has a few seconds to say one thing.'),
        step('note', 'Who it is for', 'Who will see it?', 'Knowing your audience shapes every choice.', 'related to'),
        step('picture', 'Inspiration', 'Drop in posters or pictures you like.', 'References show the AI what you mean faster than words.', 'looks like'),
        step('style', 'Look and feel', 'Bold and bright? Calm and simple?', 'Style sets the mood before anyone reads a word.', 'in the style of'),
      ],
    },
  },
  {
    match: /video|film|movie|animation|trailer|reel/i,
    plan: {
      id: 'video',
      what: 'a video',
      steps: [
        step('idea', 'The idea', 'What is the video about?', 'A clear idea keeps every scene on track.'),
        step('character', 'Characters', 'Who appears? What do they look like?', 'Consistent characters make scenes feel connected.', 'features'),
        step('style', 'Look and feel', 'What should it look like?', 'A shared style holds the video together.', 'in the style of'),
        tool('storyboard', 'Scenes', 'Creators plan shots before making them. Make a picture of each scene next.'),
        tool('video', 'Video', 'Connect your scene pictures here, and a note for captions, then press Run.'),
      ],
    },
  },
  {
    match: /lesson|teach|class|lecture|workshop|course/i,
    plan: {
      id: 'lesson',
      what: 'a lesson',
      steps: [
        step('idea', 'Learning goal', 'What should learners be able to do afterwards?', 'Starting from the goal keeps a lesson focused.'),
        tool('research', 'Key ideas', 'Gather the key points, then check them. People remember a few ideas well.'),
        step('picture', 'Examples', 'Pictures or diagrams that explain it.', 'Seeing an example makes an idea concrete.', 'looks like'),
        step('note', 'Activity', 'Something learners do, not just hear.', 'We learn best by doing.'),
        tool('script', 'Lesson script', 'A simple script helps you explain it step by step.'),
      ],
    },
  },
  {
    match: /presentation|slides|pitch|talk/i,
    plan: {
      id: 'presentation',
      what: 'a presentation',
      steps: [
        step('idea', 'Main point', 'If people remember one thing, what is it?', 'Every slide should support one main point.'),
        step('note', 'Audience', 'Who is listening, and what do they already know?', 'Good talks start where the audience is.'),
        tool('script', 'Talk outline', 'The Script Writer drafts an outline you can change.'),
        step('picture', 'Visuals', 'Pictures, charts or photos to show.', 'Pictures are remembered longer than words.', 'looks like'),
      ],
    },
  },
];

const GENERAL: Plan = {
  id: 'general',
  what: 'your project',
  steps: [
    step('idea', 'The idea', 'Describe it in one sentence.', 'Everything starts from a clear idea.'),
    step('picture', 'References', 'Drop in pictures of what you imagine.', 'References show what you mean faster than words.', 'looks like'),
    step('note', 'Details', 'Mood, colours, time of day…', 'Details turn a general idea into your idea.', 'related to'),
    step('style', 'Look and feel', 'How should it look?', 'A style keeps everything consistent.', 'in the style of'),
  ],
};

const WANTS_TO_MAKE = /\b(want|would like|like|going|help me|planning|plan|need)\b.*\b(make|create|build|do|design|draw|write|produce|plan)\b|\b(make|create|build|design|produce|plan) (a|an|my|some)\b/i;

/** Finds a plan when someone describes a project they want to make. */
export function findPlan(message: string): Plan | undefined {
  const specific = PLANS.find((p) => p.match.test(message))?.plan;
  if (specific && WANTS_TO_MAKE.test(message)) return specific;
  if (WANTS_TO_MAKE.test(message)) return GENERAL;
  return undefined;
}

export function planReply(plan: Plan): string {
  const list = plan.steps.map((s) => `• ${s.title} — ${s.why}`).join('\n');
  return `That sounds like a lovely project. When people make ${plan.what}, it usually helps to gather a few things first:\n\n${list}\n\nWould you like me to place these on your board? They’ll be connected to your main idea, so whatever you write in them feeds into your pictures and tools. You can move, change or remove any of them.`;
}

export const PRODUCER_PERSONA =
  'You are the Producer inside a visual workspace where people learn AI by building. You are a calm, warm project ' +
  'partner, not a chatbot. Use short, plain sentences and everyday words. Never use technical jargon (no "prompt", ' +
  '"model", "tokens", "parameters", "inference", "diffusion"). Suggest small next steps the person can do on their ' +
  'board: add an Idea, a Note, a Picture, a Character or a Style, and connect them. When it helps, explain briefly why ' +
  'a step makes the result better, so the person learns how AI works. Keep replies under 120 words.';

/**
 * Spots a request for a picture in plain chat ("make me a picture of a dog on
 * the moon", "draw a castle") and returns what should be in it.
 */
export function findPictureRequest(message: string): string | undefined {
  const text = message.trim().replace(/[.!?]+$/, '');
  const patterns = [
    /\b(?:picture|image|photo|drawing|painting|illustration|pic)\s+(?:of|showing|with)\s+(.+)/i,
    /\b(?:draw|paint|illustrate|sketch|show me|imagine)\s+(?:me\s+|us\s+)?(.+)/i,
  ];
  for (const re of patterns) {
    const subject = text.match(re)?.[1]?.replace(/\s*(?:please|for me|thanks|thank you)\s*$/i, '').trim();
    if (subject && subject.split(/\s+/).length >= 2 && !/^(it|that|this|them)$/i.test(subject)) return subject;
  }
  return undefined;
}
