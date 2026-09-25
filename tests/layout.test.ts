import { describe, expect, it } from 'vitest';
import { findFreeSpot, isFree } from '../src/store/layout';
import type { Card } from '../src/model/types';

const card = (x: number, y: number, w = 200, h = 100): Card => ({ id: `${x},${y}`, kind: 'note', text: '', x, y, w, h });

describe('findFreeSpot', () => {
  it('uses the first preferred spot when it is empty', () => {
    expect(findFreeSpot([card(0, 0)], 100, 100, [{ x: 400, y: 0 }])).toEqual({ x: 400, y: 0 });
  });

  it('skips preferred spots that would cover a card', () => {
    const cards = [card(0, 0), card(300, 0)];
    expect(findFreeSpot(cards, 100, 100, [{ x: 300, y: 0 }, { x: 0, y: 300 }])).toEqual({ x: 0, y: 300 });
  });

  it('finds somewhere nearby when every preferred spot is taken', () => {
    const cards = [card(0, 0, 400, 400)];
    const spot = findFreeSpot(cards, 100, 100, [{ x: 100, y: 100 }]);
    expect(isFree(cards, { ...spot, w: 100, h: 100 })).toBe(true);
  });
});
