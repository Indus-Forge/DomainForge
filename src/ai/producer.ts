import type { CardKind } from '../model/types';

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
}

export interface Plan {
  id: string;
  what: string;
  steps: PlanStep[];
}

const step = (kind: CardKind, title: string, hint: string, why: string): PlanStep => ({ kind, title, hint, why });

const PLANS: { match: RegExp; plan: Plan }[] = [
  {
    match: /documentar/i,
    plan: {
      id: 'documentary',
      what: 'a documentary',
      steps: [
        step('idea', 'The story', 'What is your documentary about, in one sentence?', 'Everything else grows from this.'),
        step('note', 'Research', 'Facts, dates and questions you want to answer.', 'Good documentaries start with what is true.'),
        step('picture', 'References', 'Drop in photos of places, people or objects.', 'Pictures keep the look of your film consistent.'),
        step('note', 'Narration', 'What will the narrator say?', 'The voice ties the pictures together.'),
        step('note', 'Timeline', 'Beginning, middle, end.', 'An order helps viewers follow along.'),
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
        step('character', 'Main character', 'Who is it about? What do they look like?', 'Describing a character once keeps them the same in every scene.'),
        step('note', 'Setting', 'Where and when does it happen?', 'A setting gives every scene a shared world.'),
        step('style', 'Look and feel', 'Cartoon, painted, pencil…?', 'One style makes the pages feel like a single book.'),
        step('note', 'Scenes', 'List the key moments.', 'Small steps are easier to create than one big leap.'),
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
        step('note', 'Who it is for', 'Who will see it?', 'Knowing your audience shapes every choice.'),
        step('picture', 'Inspiration', 'Drop in posters or pictures you like.', 'References show the AI what you mean faster than words.'),
        step('style', 'Look and feel', 'Bold and bright? Calm and simple?', 'Style sets the mood before anyone reads a word.'),
      ],
    },
  },
  {
    match: /video|film|movie|animation|trailer/i,
    plan: {
      id: 'video',
      what: 'a video',
      steps: [
        step('idea', 'The idea', 'What is the video about?', 'A clear idea keeps every scene on track.'),
        step('note', 'Storyboard', 'Describe each shot in a line.', 'Creators plan shots before filming or generating them.'),
        step('character', 'Characters', 'Who appears?', 'Consistent characters make scenes feel connected.'),
        step('style', 'Look and feel', 'What should it look like?', 'A shared style holds the video together.'),
        step('note', 'Sound', 'Voice, music, sound effects.', 'Sound carries half of the feeling in a video.'),
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
        step('note', 'Key ideas', 'Three things everyone should remember.', 'People remember a few ideas well rather than many poorly.'),
        step('picture', 'Examples', 'Pictures or diagrams that explain it.', 'Seeing an example makes an idea concrete.'),
        step('note', 'Activity', 'Something learners do, not just hear.', 'We learn best by doing.'),
        step('note', 'Check understanding', 'A question to ask at the end.', 'A quick check shows what landed.'),
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
        step('note', 'Outline', 'Opening, three sections, closing.', 'A simple shape is easy to follow.'),
        step('picture', 'Visuals', 'Pictures, charts or photos to show.', 'Pictures are remembered longer than words.'),
      ],
    },
  },
];

const GENERAL: Plan = {
  id: 'general',
  what: 'your project',
  steps: [
    step('idea', 'The idea', 'Describe it in one sentence.', 'Everything starts from a clear idea.'),
    step('picture', 'References', 'Drop in pictures of what you imagine.', 'References show what you mean faster than words.'),
    step('note', 'Details', 'Mood, colours, time of day…', 'Details turn a general idea into your idea.'),
    step('style', 'Look and feel', 'How should it look?', 'A style keeps everything consistent.'),
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
  return `That sounds like a lovely project. When people make ${plan.what}, it usually helps to gather a few things first:\n\n${list}\n\nWould you like me to place these on your board? You can move, change or remove any of them.`;
}

export const PRODUCER_PERSONA =
  'You are the Producer inside a visual workspace where people learn AI by building. You are a calm, warm project ' +
  'partner, not a chatbot. Use short, plain sentences and everyday words. Never use technical jargon (no "prompt", ' +
  '"model", "tokens", "parameters", "inference", "diffusion"). Suggest small next steps the person can do on their ' +
  'board: add an Idea, a Note, a Picture, a Character or a Style, and connect them. When it helps, explain briefly why ' +
  'a step makes the result better, so the person learns how AI works. Keep replies under 120 words.';
