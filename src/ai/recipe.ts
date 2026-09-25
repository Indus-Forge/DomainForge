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
        if (link.kind === 'origin') continue;
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
  const visits = gatherConnected(board, startId);
  const ingredients: Ingredient[] = [];
  let referenceImage: string | undefined;
  const refLines: string[] = [];

  for (const { card, via, steps } of visits) {
    const role = roleFor(card, steps === 0);
    const text = cardWords(card);
    if (role === 'reference' && card.image && !referenceImage) referenceImage = card.image;
    if (!text && !(role === 'reference' && card.image)) continue;

    ingredients.push({ cardId: card.id, kind: card.kind, role, text, why: explain(role, card, via), image: card.image });

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
