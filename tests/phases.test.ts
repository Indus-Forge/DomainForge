import { describe, expect, it } from 'vitest';
import { buildRecipe, compareRecipes, presentationOrder, scenesFromText } from '../src/ai/recipe';
import { cleanSvg } from '../src/ai/svg';
import { fitFor, tidySuggestions, CATALOGUE, describeComputer } from '../src/ai/models';
import { processSummaryHtml } from '../src/learn/process';
import type { Card, Link, Project } from '../src/model/types';

const card = (id: string, kind: Card['kind'], text: string, extra: Partial<Card> = {}): Card => ({
  id, kind, text, x: 0, y: 0, w: 100, h: 100, ...extra,
});
const link = (from: string, to: string, label = 'related to', extra: Partial<Link> = {}): Link => ({
  id: `${from}-${to}`, from, to, label, ...extra,
});

describe('tools use the recipe builder', () => {
  it('treats the first connected idea as the main idea when starting from a tool', () => {
    const cards = [
      card('tool', 'tool', '', { tool: 'image' }),
      card('style', 'style', 'pencil sketch'),
      card('idea', 'idea', 'a fox in the snow'),
    ];
    const r = buildRecipe({ cards, links: [link('style', 'tool', 'in the style of'), link('idea', 'tool')] }, 'tool');
    expect(r.ingredients.map((i) => i.role)).toEqual(['style', 'subject']);
    expect(r.description).toBe('A fox in the snow. Style: pencil sketch.');
  });

  it('makes an empty recipe when nothing is connected', () => {
    expect(buildRecipe({ cards: [card('tool', 'tool', '', { tool: 'image' })], links: [] }, 'tool').description).toBe('');
  });
});

describe('compareRecipes', () => {
  it('lists what was added, removed and reworded', () => {
    const before = { startCardId: 'a', description: 'A cat.', ingredients: [
      { cardId: 'a', kind: 'idea' as const, role: 'subject' as const, text: 'a cat', why: '' },
      { cardId: 's', kind: 'style' as const, role: 'style' as const, text: 'watercolour', why: '' },
    ] };
    const after = { startCardId: 'a', description: 'A black cat.', ingredients: [
      { cardId: 'a', kind: 'idea' as const, role: 'subject' as const, text: 'a black cat', why: '' },
      { cardId: 'n', kind: 'note' as const, role: 'detail' as const, text: 'at night', why: '' },
    ] };
    const c = compareRecipes(before, after);
    expect(c.added.map((i) => i.text)).toEqual(['at night']);
    expect(c.removed.map((i) => i.text)).toEqual(['watercolour']);
    expect(c.reworded[0].after.text).toBe('a black cat');
    expect(c.wordsChanged).toBe(true);
  });
});

describe('scenesFromText', () => {
  it('makes one scene per sentence without any AI', () => {
    expect(scenesFromText('A bee wakes up. It finds a flower! Then it flies home.')).toEqual([
      { title: 'Scene 1', description: 'A bee wakes up' },
      { title: 'Scene 2', description: 'It finds a flower' },
      { title: 'Scene 3', description: 'Then it flies home' },
    ]);
  });
});

describe('presentationOrder', () => {
  it('follows then connections from the start of the chain', () => {
    const cards = [card('c', 'note', 'three'), card('a', 'idea', 'one'), card('b', 'note', 'two')];
    const links = [link('b', 'c', 'then'), link('a', 'b', 'then')];
    expect(presentationOrder({ cards, links }).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('falls back to creations, oldest first', () => {
    const cards = [
      card('new', 'creation', '', { image: 'data:x', recipe: { startCardId: 'x', description: '', ingredients: [], createdAt: 2 } }),
      card('old', 'creation', '', { image: 'data:x', recipe: { startCardId: 'x', description: '', ingredients: [], createdAt: 1 } }),
    ];
    expect(presentationOrder({ cards, links: [] }).map((c) => c.id)).toEqual(['old', 'new']);
  });
});

describe('cleanSvg', () => {
  it('extracts the drawing and strips anything that could run code', () => {
    const raw = 'Here you go:\n```svg\n<svg viewBox="0 0 10 10" onload="alert(1)"><script>alert(2)</script><a href="https://evil"><rect/></a></svg>\n```';
    const svg = cleanSvg(raw);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).not.toMatch(/script|onload|evil/);
  });

  it('explains when there is no drawing', () => {
    expect(() => cleanSvg('Sorry, I cannot draw that.')).toThrow(/didn’t come back as a picture/);
  });
});

describe('model library', () => {
  const everyday = CATALOGUE.find((m) => m.id === 'llama3.2')!;

  it('describes fit in friendly terms', () => {
    expect(fitFor(everyday, { memoryGB: 16, estimated: false })).toBe('comfortable');
    expect(fitFor(everyday, { memoryGB: 6, estimated: false })).toBe('slow');
    expect(fitFor(everyday, { memoryGB: 2, estimated: false })).toBe('too-big');
    expect(fitFor(everyday, { memoryGB: 32, freeDiskGB: 1, estimated: false })).toBe('too-big');
    expect(describeComputer({ memoryGB: 8, estimated: false })).toMatch(/comfortably run the everyday tools/);
    expect(describeComputer({ estimated: true })).not.toMatch(/GB|VRAM/);
  });

  it('only suggests tidying tools unused for a month, largest first', () => {
    const now = 100 * 86400000;
    const installed = [
      { id: 'small', sizeGB: 1, installedAt: 0 },
      { id: 'big', sizeGB: 5, installedAt: 0 },
      { id: 'recent', sizeGB: 9, installedAt: 0 },
    ];
    const used = { recent: now - 86400000 };
    expect(tidySuggestions(installed, now, used).map((m) => m.id)).toEqual(['big', 'small']);
  });
});

describe('show the process', () => {
  it('summarises creations with their recipes and escapes everything', () => {
    const project: Project = {
      id: 'p', name: 'Bees <script>', createdAt: 0, updatedAt: 0, version: 1, viewport: { x: 0, y: 0, zoom: 1 },
      cards: [
        card('i', 'idea', 'A bee <b>', {}),
        card('c', 'creation', '', {
          image: 'data:image/png;base64,AAAA',
          recipe: { startCardId: 'i', description: 'A bee.', sent: 'A busy bee.', madeWith: 'Sketch preview', createdAt: 1,
            ingredients: [{ cardId: 'i', kind: 'idea', role: 'subject', text: 'A bee <b>', why: 'Main idea.' }] },
        }),
      ],
      links: [link('i', 'c', 'made', { kind: 'origin' })],
    };
    const html = processSummaryHtml(project, ['first-link']);
    expect(html).toContain('Bees &lt;script&gt;');
    expect(html).toContain('A busy bee.');
    expect(html).toContain('Changed from the board’s words');
    expect(html).toContain('Connections become instructions');
    expect(html).toContain('A bee &lt;b&gt;');
    expect(html).not.toContain('A bee <b>');
  });
});
