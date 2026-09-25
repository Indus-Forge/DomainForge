import { useState } from 'react';
import type { Card, Link } from '../model/types';
import { LINK_PHRASES } from '../model/cards';
import { useBoard } from '../store/board';

interface Point {
  x: number;
  y: number;
}

/** Where the line from a card's centre towards `toward` leaves the card. */
function edgePoint(c: Card, toward: Point): Point {
  const cx = c.x + c.w / 2;
  const cy = c.y + c.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const scale = Math.min(Math.abs(c.w / 2 / (dx || 1e-9)), Math.abs(c.h / 2 / (dy || 1e-9)));
  return { x: cx + dx * Math.min(scale, 1), y: cy + dy * Math.min(scale, 1) };
}

const centre = (c: Card): Point => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 });

export function linkEnds(a: Card, b: Card) {
  return { start: edgePoint(a, centre(b)), end: edgePoint(b, centre(a)) };
}

export function LinkLines({ cards, links, pending }: { cards: Card[]; links: Link[]; pending?: { from: Card; to: Point } }) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  return (
    <svg className="links" aria-hidden>
      <defs>
        <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7">
          <circle cx="5" cy="5" r="4" className="links__dot" />
        </marker>
      </defs>
      {links.map((l) => {
        const a = byId.get(l.from);
        const b = byId.get(l.to);
        if (!a || !b) return null;
        const { start, end } = linkEnds(a, b);
        return (
          <line
            key={l.id}
            className={l.kind === 'origin' ? 'links__line links__line--origin' : 'links__line'}
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            markerStart="url(#dot)"
            markerEnd="url(#dot)"
          />
        );
      })}
      {pending && (
        <line
          className="links__line links__line--pending"
          x1={centre(pending.from).x}
          y1={centre(pending.from).y}
          x2={pending.to.x}
          y2={pending.to.y}
        />
      )}
    </svg>
  );
}

/** The words on each connection. Clicking them lets people change what the connection means. */
export function LinkLabels({ cards, links }: { cards: Card[]; links: Link[] }) {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const [open, setOpen] = useState<string | null>(null);
  const { updateLink, deleteLink } = useBoard.getState();

  return (
    <>
      {links.map((l) => {
        const a = byId.get(l.from);
        const b = byId.get(l.to);
        if (!a || !b) return null;
        const { start, end } = linkEnds(a, b);
        const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        const origin = l.kind === 'origin';
        return (
          <div key={l.id} className="link-label" style={{ left: mid.x, top: mid.y }} onPointerDown={(e) => e.stopPropagation()}>
            <button
              className={`link-label__pill${origin ? ' link-label__pill--origin' : ''}`}
              onClick={() => setOpen(open === l.id ? null : l.id)}
              title={origin ? 'This creation was made from here' : 'Change what this connection means'}
            >
              {l.label}
            </button>
            {open === l.id && (
              <div className="popover" role="menu">
                {!origin && (
                  <>
                    <p className="popover__title">What does this connection mean?</p>
                    {LINK_PHRASES.map((p) => (
                      <button
                        key={p}
                        role="menuitemradio"
                        aria-checked={p === l.label}
                        className={p === l.label ? 'is-current' : ''}
                        onClick={() => {
                          updateLink(l.id, { label: p });
                          setOpen(null);
                        }}
                      >
                        {p}
                      </button>
                    ))}
                    <hr />
                  </>
                )}
                <button
                  className="popover__danger"
                  onClick={() => {
                    deleteLink(l.id);
                    setOpen(null);
                  }}
                >
                  Remove connection
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
