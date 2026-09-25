import type { Card } from '../model/types';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const GAP = 40;

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;
}

export function isFree(cards: Card[], r: Rect) {
  return !cards.some((c) => overlaps(r, c));
}

/**
 * Finds room for something new without covering anyone's work. Tries the
 * preferred top-left corners in order, then spirals outward from the first.
 */
export function findFreeSpot(cards: Card[], w: number, h: number, preferred: { x: number; y: number }[]) {
  for (const p of preferred) if (isFree(cards, { ...p, w, h })) return p;
  const start = preferred[0];
  const step = 60;
  for (let ring = 1; ring <= 40; ring++) {
    const points = ring * 8;
    for (let i = 0; i < points; i++) {
      const a = (i / points) * Math.PI * 2;
      const p = { x: Math.round(start.x + Math.cos(a) * ring * step), y: Math.round(start.y + Math.sin(a) * ring * step) };
      if (isFree(cards, { ...p, w, h })) return p;
    }
  }
  return start;
}
