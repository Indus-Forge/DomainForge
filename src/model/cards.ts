import type { CardKind } from './types';

/**
 * The card catalogue. Names and hints are written for someone who has never
 * used an AI tool before.
 */
export interface CardInfo {
  kind: CardKind;
  name: string;
  icon: string;
  hint: string;
  placeholder: string;
  w: number;
  h: number;
  /** Shown in the toolbar. Creations are only ever made by the AI. */
  addable: boolean;
  /** Can a picture be made starting from this card? */
  canCreateFrom: boolean;
}

export const CARD_INFO: Record<CardKind, CardInfo> = {
  idea: {
    kind: 'idea',
    name: 'Idea',
    icon: '💬',
    hint: 'Say what you want to make, in your own words.',
    placeholder: 'A hero explores a futuristic city…',
    w: 240,
    h: 130,
    addable: true,
    canCreateFrom: true,
  },
  note: {
    kind: 'note',
    name: 'Note',
    icon: '🗒️',
    hint: 'Add a detail: a time of day, a mood, a colour.',
    placeholder: 'At night, after the rain…',
    w: 200,
    h: 160,
    addable: true,
    canCreateFrom: true,
  },
  picture: {
    kind: 'picture',
    name: 'Picture',
    icon: '🖼️',
    hint: 'Add a photo or drawing to show what something looks like.',
    placeholder: 'What is in this picture?',
    w: 240,
    h: 250,
    addable: true,
    canCreateFrom: false,
  },
  character: {
    kind: 'character',
    name: 'Character',
    icon: '🧑‍🚀',
    hint: 'Describe someone who appears in your work.',
    placeholder: 'A young explorer with a red scarf and a curious look',
    w: 240,
    h: 170,
    addable: true,
    canCreateFrom: true,
  },
  style: {
    kind: 'style',
    name: 'Style',
    icon: '🎨',
    hint: 'Describe how it should look: painted, photographic, cartoon…',
    placeholder: 'Soft watercolour with warm evening light',
    w: 230,
    h: 150,
    addable: true,
    canCreateFrom: false,
  },
  tool: {
    kind: 'tool',
    name: 'Tool',
    icon: '🧰',
    hint: 'Connect cards to it, then press Run.',
    placeholder: '',
    w: 270,
    h: 280,
    addable: false,
    canCreateFrom: false,
  },
  video: {
    kind: 'video',
    name: 'Video',
    icon: '🎬',
    hint: 'A short video made from your pictures.',
    placeholder: '',
    w: 320,
    h: 250,
    addable: false,
    canCreateFrom: false,
  },
  creation: {
    kind: 'creation',
    name: 'Creation',
    icon: '✨',
    hint: 'Something the AI made from your board.',
    placeholder: '',
    w: 280,
    h: 300,
    addable: false,
    canCreateFrom: false,
  },
};

/** Relationship phrases people can choose for a connection. */
export const LINK_PHRASES = [
  'looks like',
  'in the style of',
  'features',
  'takes place in',
  'inspired by',
  'then',
  'related to',
] as const;

/** A sensible first guess at what a new connection means, based on what it connects to. */
export function suggestLinkLabel(fromKind: CardKind, toKind: CardKind): string {
  const kinds = [fromKind, toKind];
  if (kinds.includes('style')) return 'in the style of';
  if (kinds.includes('character')) return 'features';
  if (kinds.includes('picture') || kinds.includes('creation')) return 'looks like';
  return 'related to';
}
