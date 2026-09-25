/**
 * The board is the prompt.
 *
 * Everything a person places on the canvas is a Card. Everything they draw
 * between cards is a Link, and every Link carries a short phrase in plain
 * words ("looks like", "in the style of"). Those phrases are what turn a
 * whiteboard into instructions an AI can follow.
 */

export type CardKind = 'idea' | 'note' | 'picture' | 'character' | 'style' | 'creation';

export interface Card {
  id: string;
  kind: CardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Main words on the card: the idea, the note, a picture's caption, a character or style description. */
  text: string;
  /** Short name, used by characters and styles ("Mira", "Watercolour"), or a heading on a planned card. */
  title?: string;
  /** Gentle guidance shown while the card is empty (the Producer uses this when it lays out a plan). */
  hint?: string;
  /** A picture the person added, or one the AI created (data URL, stored locally). */
  image?: string;
  /** Only on creations: exactly how this picture was made. */
  recipe?: Recipe;
  status?: 'working' | 'error';
  statusMessage?: string;
}

export interface Link {
  id: string;
  from: string;
  to: string;
  /** The relationship in plain words. */
  label: string;
  /** 'origin' links connect a creation back to where it came from. They never feed into new recipes. */
  kind?: 'origin';
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Board {
  cards: Card[];
  links: Link[];
  viewport: Viewport;
}

export interface Project extends Board {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  version: 1;
}

export type IngredientRole = 'subject' | 'character' | 'detail' | 'reference' | 'style';

/** One card that went into a recipe, and why it matters. */
export interface Ingredient {
  cardId: string;
  kind: CardKind;
  role: IngredientRole;
  /** The words this card contributes. */
  text: string;
  /** A human explanation of why this card was used. */
  why: string;
  image?: string;
}

/**
 * A recipe is the visible version of a "prompt": the cards that were used,
 * why each was used, and the description that was finally sent to the AI.
 */
export interface Recipe {
  startCardId: string;
  ingredients: Ingredient[];
  /** Built directly from the board, word for word. */
  description: string;
  /** Optional rewrite by the private assistant. Kept alongside the original so people can compare. */
  polished?: string;
  /** The words that were actually sent: the board's, the assistant's, or the person's own edit. */
  sent?: string;
  /** The picture used to guide the look, if one was connected. */
  referenceImage?: string;
  /** Friendly name of the tool that made the picture. */
  madeWith?: string;
  createdAt?: number;
}
