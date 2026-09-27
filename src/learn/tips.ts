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
  | 'iteration'
  | 'plan-placed'
  | 'polished'
  | 'described-picture'
  | 'online-assistant'
  | 'tool-used'
  | 'check-facts'
  | 'storyboard-made'
  | 'voice'
  | 'enlarged'
  | 'compare-versions'
  | 'presented'
  | 'video-made'
  | 'video-directed';

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
  'online-assistant': {
    title: 'Where your AI runs matters',
    body: 'That answer came from an online service, so your words travelled over the internet to reach it. A private model running on your own computer (through Ollama) keeps everything on it. The AI Hub shows which is which.',
  },
  'tool-used': {
    title: 'Input → process → output',
    body: 'Every tool works the same way: it takes what you connect to it, does one job, and puts the result on your board. Chaining tools is how bigger AI projects are built.',
  },
  'check-facts': {
    title: 'AI can sound sure and still be wrong',
    body: 'Research notes from AI are a starting point, not the truth. Check important facts in a trusted source before you rely on them.',
  },
  'storyboard-made': {
    title: 'Plan the scenes, then make them',
    body: 'Each scene is its own idea card, already connected to your characters and style. Making each scene from the same connections keeps them consistent.',
  },
  voice: {
    title: 'Computers have voices built in',
    body: 'This voice comes from your computer’s own speech engine. AI voice tools learn from recordings of real people, which is why asking permission to copy a voice matters.',
  },
  enlarged: {
    title: 'Stretching vs. imagining detail',
    body: 'Simple enlarging stretches the pixels you already have. AI upscalers guess new detail that was never there, which looks sharper but can invent things.',
  },
  'compare-versions': {
    title: 'Change one thing at a time',
    body: 'Comparing versions shows what each change did. Scientists call this a fair test: change one thing, keep everything else the same.',
  },
  'video-made': {
    title: 'Moving a camera vs. imagining motion',
    body: 'This video was made by gliding a virtual camera over your picture, so nothing in it is invented. AI video tools instead predict new frames that never existed: they can show real motion, but they can also warp faces and hands.',
  },
  'video-directed': {
    title: 'The AI chose where to look',
    body: 'Vision AIs can find what matters in a picture: faces, eyes, movement. It’s the same skill that lets a phone camera focus on faces. Open “How this was edited” to see each choice and the reason for it.',
  },
  presented: {
    title: 'Your board tells a story',
    body: 'The “then” connections set the order. Presenting shows your process as well as your results, which is how people learn from each other’s work.',
  },
  'described-picture': {
    title: 'AI turns pictures into words',
    body: 'Your assistant looked at the picture and described it. Many AI tools work this way: they translate pictures into words and back again.',
  },
};
