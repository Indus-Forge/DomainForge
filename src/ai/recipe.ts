import type { Board, Card, Ingredient, IngredientRole, Link, Recipe } from '../model/types';
import { CARD_INFO } from '../model/cards';

/**
 * Turns a board into a recipe.
 *
 * Starting from the card someone chose, we follow their connections (up to two
 * steps away), decide what role each connected card plays, and write a plain
 * description. Nothing here is hidden or clever: the same board always gives
 * the same recipe, so people can learn how their connections shape the result.
 */

const MAX_STEPS = 2;
const REFERENCE_PHRASES = new Set(['looks like', 'inspired by', 'takes place in']);

interface Visit {
  card: Card;
  via?: Link;
  steps: number;
}

function roleFor(card: Card, isStart: boolean): IngredientRole {
  if (isStart) return 'subject';
  switch (card.kind) {
    case 'character':
      return 'character';
    case 'picture':
    case 'creation':
      return 'reference';
    case 'style':
      return 'style';
    default:
      return 'detail';
  }
}

function clean(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function sentence(text: string): string {
  const t = clean(text);
  if (!t) return '';
  const first = t[0].toUpperCase() + t.slice(1);
  return /[.!?]$/.test(first) ? first : `${first}.`;
}

function withoutFullStop(text: string): string {
  return clean(text).replace(/[.!?]+$/, '');
}

function cardWords(card: Card): string {
  const title = clean(card.title);
  const text = clean(card.text);
  if ((card.kind === 'character' || card.kind === 'style') && title) {
    return text ? `${title} — ${text}` : title;
  }
  if (card.kind === 'creation') return text || clean(card.recipe?.description);
  return text;
}

function explain(role: IngredientRole, card: Card, via?: Link): string {
  const how = via ? ` with “${via.label}”` : '';
  switch (role) {
    case 'subject':
      return 'This is where you started, so the picture is built around it.';
    case 'character':
      return `You connected this character${how}, so they will appear in the picture.`;
    case 'detail':
      return `You connected this ${CARD_INFO[card.kind].name.toLowerCase()}${how}, so it adds detail.`;
    case 'reference':
      return clean(card.text)
        ? `You connected this picture${how}. Its caption describes it in words, and the picture itself guides the look.`
        : `You connected this picture${how}, so it guides the look. Adding a caption helps the AI understand what is in it.`;
    case 'style':
      return `You connected this style${how}, so the whole picture follows it.`;
  }
}

/** Walk outward from the starting card, following connections in either direction. */
export function gatherConnected(board: Pick<Board, 'cards' | 'links'>, startId: string): Visit[] {
  const byId = new Map(board.cards.map((c) => [c.id, c]));
  const start = byId.get(startId);
  if (!start) return [];

  const visits: Visit[] = [{ card: start, steps: 0 }];
  const seen = new Set([startId]);
  let frontier = [startId];

  for (let step = 1; step <= MAX_STEPS && frontier.length; step++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const link of board.links) {
        // "made" links point back to where a result came from, and "then" links only set an order.
        // Neither adds ingredients.
        if (link.kind === 'origin' || link.label === 'then') continue;
        const other = link.from === id ? link.to : link.to === id ? link.from : undefined;
        if (!other || seen.has(other)) continue;
        const card = byId.get(other);
        if (!card) continue;
        seen.add(other);
        visits.push({ card, via: link, steps: step });
        next.push(other);
      }
    }
    frontier = next;
  }
  return visits;
}

export function buildRecipe(board: Pick<Board, 'cards' | 'links'>, startId: string): Recipe {
  let visits = gatherConnected(board, startId);
  // A tool has no words of its own: the first idea connected to it becomes the main idea.
  let subjectIndex = 0;
  if (visits[0]?.card.kind === 'tool') {
    visits = visits.slice(1);
    const order: Card['kind'][] = ['idea', 'note', 'character'];
    const found = order.map((k) => visits.findIndex((v) => v.card.kind === k && cardWords(v.card))).find((i) => i >= 0);
    subjectIndex = found ?? -1;
  }
  const ingredients: Ingredient[] = [];
  let referenceImage: string | undefined;
  const refLines: string[] = [];

  for (const [index, { card, via }] of visits.entries()) {
    if (card.kind === 'tool') continue;
    const role = roleFor(card, index === subjectIndex);
    const text = cardWords(card);
    if (role === 'reference' && card.image && !referenceImage) referenceImage = card.image;
    if (!text && !(role === 'reference' && card.image)) continue;

    const why = role === 'subject' && index > 0 ? 'This is the main idea connected to the tool, so the result is built around it.' : explain(role, card, via);
    ingredients.push({ cardId: card.id, kind: card.kind, role, text, why, image: card.image });

    if (role === 'reference' && text) {
      const phrase = via && REFERENCE_PHRASES.has(via.label) ? via.label : 'looks like';
      refLines.push(`${phrase[0].toUpperCase()}${phrase.slice(1)}: ${withoutFullStop(text)}.`);
    }
  }

  const of = (role: IngredientRole) => ingredients.filter((i) => i.role === role && i.text);

  const parts: string[] = [];
  parts.push(...of('subject').map((i) => sentence(i.text)));

  const characters = of('character').map((i) => withoutFullStop(i.text));
  if (characters.length) parts.push(`Featuring ${characters.join('; and ')}.`);

  parts.push(...of('detail').map((i) => sentence(i.text)));
  parts.push(...refLines);

  const styles = of('style').map((i) => withoutFullStop(i.text));
  if (styles.length) parts.push(`Style: ${styles.join(', ')}.`);

  return {
    startCardId: startId,
    ingredients,
    description: parts.filter(Boolean).join(' '),
    referenceImage,
  };
}

/**
 * A short plain-language summary of the whole board. This is exactly what the
 * assistant is shown, and the app displays it so people can see what it sees.
 */
export function describeBoard(board: Pick<Board, 'cards' | 'links'>): string {
  if (!board.cards.length) return 'The board is empty.';
  const name = (c: Card) => {
    const words = cardWords(c) || (c.image ? 'a picture with no caption' : 'empty');
    return `${CARD_INFO[c.kind].name} “${words.length > 80 ? `${words.slice(0, 77)}…` : words}”`;
  };
  const byId = new Map(board.cards.map((c) => [c.id, c]));
  const lines = board.cards.map((c) => `- ${name(c)}`);
  const links = board.links
    .map((l) => {
      const a = byId.get(l.from);
      const b = byId.get(l.to);
      return a && b ? `- ${name(a)} → ${l.label} → ${name(b)}` : '';
    })
    .filter(Boolean);
  return [`Cards on the board:`, ...lines, ...(links.length ? ['Connections:', ...links] : [])].join('\n');
}

/** What changed between two recipes, in plain words. Used to compare versions of a creation. */
export interface RecipeChanges {
  added: Ingredient[];
  removed: Ingredient[];
  reworded: { before: Ingredient; after: Ingredient }[];
  wordsChanged: boolean;
}

export function compareRecipes(before: Recipe, after: Recipe): RecipeChanges {
  const beforeById = new Map(before.ingredients.map((i) => [i.cardId, i]));
  const afterById = new Map(after.ingredients.map((i) => [i.cardId, i]));
  return {
    added: after.ingredients.filter((i) => !beforeById.has(i.cardId)),
    removed: before.ingredients.filter((i) => !afterById.has(i.cardId)),
    reworded: after.ingredients
      .filter((i) => beforeById.has(i.cardId) && beforeById.get(i.cardId)!.text !== i.text)
      .map((i) => ({ before: beforeById.get(i.cardId)!, after: i })),
    wordsChanged: (before.sent ?? before.description) !== (after.sent ?? after.description),
  };
}

/** Splits writing into scenes without any AI: one scene per sentence, up to six. */
export function scenesFromText(text: string, max = 6): { title: string; description: string }[] {
  const sentences = clean(text)
    .split(/(?<=[.!?])\s+|\n+/)
    .map((t) => withoutFullStop(t))
    .filter((t) => t.length > 2);
  return sentences.slice(0, max).map((description, i) => ({ title: `Scene ${i + 1}`, description }));
}

/**
 * The order to present a board in. Follows "then" connections from the start
 * of each chain; if there are none, shows creations from oldest to newest.
 */
export function presentationOrder(board: Pick<Board, 'cards' | 'links'>): Card[] {
  const byId = new Map(board.cards.map((c) => [c.id, c]));
  const next = new Map<string, string>();
  const hasPrevious = new Set<string>();
  for (const l of board.links) {
    if (l.label !== 'then' || l.kind === 'origin' || next.has(l.from)) continue;
    next.set(l.from, l.to);
    hasPrevious.add(l.to);
  }
  const order: Card[] = [];
  const seen = new Set<string>();
  const heads = board.cards.filter((c) => next.has(c.id) && !hasPrevious.has(c.id)).sort((a, b) => a.y - b.y || a.x - b.x);
  for (const head of heads) {
    for (let id: string | undefined = head.id; id && !seen.has(id); id = next.get(id)) {
      seen.add(id);
      const card = byId.get(id);
      if (card && card.kind !== 'tool') order.push(card);
    }
  }
  if (order.length) return order;
  return board.cards
    .filter((c) => c.kind === 'creation' && c.image)
    .sort((a, b) => (a.recipe?.createdAt ?? 0) - (b.recipe?.createdAt ?? 0));
}

/** Creations made from a card, oldest first (for slides and version history). */
export function creationsFrom(board: Pick<Board, 'cards' | 'links'>, cardId: string): Card[] {
  const ids = new Set(board.links.filter((l) => l.kind === 'origin' && l.from === cardId).map((l) => l.to));
  return board.cards
    .filter((c) => ids.has(c.id) && c.kind === 'creation' && c.image)
    .sort((a, b) => (a.recipe?.createdAt ?? 0) - (b.recipe?.createdAt ?? 0));
}
