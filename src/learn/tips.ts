/**
 * Learning happens by doing. Each discovery appears once, at the moment it is
 * relevant, and is kept in the Discoveries list for later.
 */

export type LearnEvent =
  | 'welcome'
  | 'first-link'
  | 'reference-linked'
  | 'character-linked'
  | 'style-linked'
  | 'recipe-opened'
  | 'first-creation'
  | 'sketch-made'
  | 'iteration'
  | 'plan-placed'
  | 'polished'
  | 'described-picture';

export interface Tip {
  title: string;
  body: string;
}

export const TIPS: Record<LearnEvent, Tip> = {
  welcome: {
    title: 'Your board is the instruction',
    body: 'Instead of typing a perfect sentence, you place ideas and connect them. The AI reads your connections.',
  },
  'first-link': {
    title: 'Connections become instructions',
    body: 'The words on a connection tell the AI how two things relate. Click them to choose different words.',
  },
  'reference-linked': {
    title: 'Pictures help with consistency',
    body: 'Reference pictures show the AI what you mean. Creators gather references before they create, so results match their vision.',
  },
  'character-linked': {
    title: 'Describe once, reuse everywhere',
    body: 'Connect the same Character card to every scene, and the AI gets the same description each time. That keeps them recognisable.',
  },
  'style-linked': {
    title: 'Style is its own ingredient',
    body: 'Keeping the style on its own card means you can swap it later without rewriting your idea.',
  },
  'recipe-opened': {
    title: 'This is what the AI actually reads',
    body: 'AI does not see your board. It reads a description made from it. Here you can see every piece, and why it was used.',
  },
  'first-creation': {
    title: 'You made something with AI',
    body: 'Your creation is connected to where it came from. Click “How this was made” any time to see the recipe.',
  },
  'sketch-made': {
    title: 'This is a sketch, not AI art',
    body: 'Sketch preview lays out your recipe so you can practise the whole process. When an image studio is set up on your computer, the same board will make real pictures.',
  },
  iteration: {
    title: 'Building on results',
    body: 'Using a creation as a new reference is called iterating: each round gets closer to what you imagine. Professionals rarely stop at the first try.',
  },
  'plan-placed': {
    title: 'Small steps, better results',
    body: 'Breaking a big project into steps usually produces better results, for people and for AI.',
  },
  polished: {
    title: 'Same ideas, smoother words',
    body: 'Your assistant rewrote the description, keeping every ingredient. Compare the two: you can use whichever you like.',
  },
  'described-picture': {
    title: 'AI turns pictures into words',
    body: 'Your assistant looked at the picture and described it. Many AI tools work this way: they translate pictures into words and back again.',
  },
};
