import { describe, expect, it } from 'vitest';
import { buildRecipe, describeBoard, gatherConnected } from '../src/ai/recipe';
import type { Card, Link } from '../src/model/types';

const card = (id: string, kind: Card['kind'], text: string, extra: Partial<Card> = {}): Card => ({
  id, kind, text, x: 0, y: 0, w: 100, h: 100, ...extra,
});
const link = (from: string, to: string, label = 'related to', extra: Partial<Link> = {}): Link => ({
  id: `${from}-${to}`, from, to, label, ...extra,
});

describe('buildRecipe', () => {
  it('builds the hero example from the product brief', () => {
    const cards = [
      card('hero', 'idea', 'A hero explores a futuristic city'),
      card('ref', 'picture', 'neon towers reflected in wet streets', { image: 'data:image/png;base64,AAA' }),
    ];
    const recipe = buildRecipe({ cards, links: [link('hero', 'ref', 'looks like')] }, 'hero');

    expect(recipe.description).toBe('A hero explores a futuristic city. Looks like: neon towers reflected in wet streets.');
    expect(recipe.referenceImage).toBe('data:image/png;base64,AAA');
    expect(recipe.ingredients.map((i) => i.role)).toEqual(['subject', 'reference']);
    expect(recipe.ingredients[1].why).toContain('“looks like”');
  });

  it('gives each kind of card its own role and orders the description', () => {
    const cards = [
      card('idea', 'idea', 'a lighthouse on a cliff'),
      card('style', 'style', 'soft watercolour', { title: 'Watercolour' }),
      card('mira', 'character', 'a keeper with a lantern', { title: 'Mira' }),
      card('note', 'note', 'stormy night'),
    ];
    const links = [link('idea', 'style', 'in the style of'), link('idea', 'mira', 'features'), link('note', 'idea')];
    const recipe = buildRecipe({ cards, links }, 'idea');

    expect(recipe.description).toBe(
      'A lighthouse on a cliff. Featuring Mira — a keeper with a lantern. Stormy night. Style: Watercolour — soft watercolour.',
    );
  });

  it('follows connections two steps away but no further', () => {
    const cards = [card('a', 'idea', 'one'), card('b', 'note', 'two'), card('c', 'note', 'three'), card('d', 'note', 'four')];
    const links = [link('a', 'b'), link('b', 'c'), link('c', 'd')];
    expect(gatherConnected({ cards, links }, 'a').map((v) => v.card.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not treat "then" (order) as an ingredient', () => {
    const cards = [card('a', 'idea', 'scene one'), card('b', 'idea', 'scene two')];
    expect(buildRecipe({ cards, links: [link('a', 'b', 'then')] }, 'a').description).toBe('Scene one.');
  });

  it('never feeds a creation back into the recipe it came from', () => {
    const cards = [card('a', 'idea', 'a cat'), card('made', 'creation', 'old result', { image: 'data:x' })];
    const recipe = buildRecipe({ cards, links: [link('made', 'a', 'made from', { kind: 'origin' })] }, 'a');
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.referenceImage).toBeUndefined();
  });

  it('keeps an uncaptioned picture as a visual guide and suggests a caption', () => {
    const cards = [card('a', 'idea', 'a garden'), card('p', 'picture', '', { image: 'data:img' })];
    const recipe = buildRecipe({ cards, links: [link('a', 'p', 'looks like')] }, 'a');
    expect(recipe.description).toBe('A garden.');
    expect(recipe.referenceImage).toBe('data:img');
    expect(recipe.ingredients[1].why).toContain('caption');
  });

  it('skips empty cards', () => {
    const cards = [card('a', 'idea', 'a boat'), card('b', 'note', '   ')];
    expect(buildRecipe({ cards, links: [link('a', 'b')] }, 'a').ingredients).toHaveLength(1);
  });
});

describe('describeBoard', () => {
  it('lists cards and connections in plain words', () => {
    const cards = [card('a', 'idea', 'a boat'), card('b', 'style', 'pencil sketch')];
    const text = describeBoard({ cards, links: [link('a', 'b', 'in the style of')] });
    expect(text).toContain('Idea “a boat”');
    expect(text).toContain('Idea “a boat” → in the style of → Style “pencil sketch”');
  });
});
