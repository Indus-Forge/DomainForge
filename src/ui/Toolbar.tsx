import { CARD_INFO } from '../model/cards';
import type { CardKind } from '../model/types';
import { useBoard } from '../store/board';
import { canvasSize, fitToCards, viewCenter, zoomBy } from '../canvas/Canvas';

const ADDABLE = (Object.keys(CARD_INFO) as CardKind[]).filter((k) => CARD_INFO[k].addable);

export function Toolbar() {
  const addCard = useBoard.getState().addCard;
  return (
    <nav className="toolbar" aria-label="Add to your board">
      {ADDABLE.map((kind) => {
        const info = CARD_INFO[kind];
        return (
          <button
            key={kind}
            className="toolbar__item"
            title={info.hint}
            onClick={() => {
              const c = viewCenter();
              const jitter = () => Math.round((Math.random() - 0.5) * 80);
              addCard(kind, { x: c.x + jitter(), y: c.y + jitter() });
              requestAnimationFrame(() =>
                document.querySelector<HTMLElement>('.card.is-selected textarea, .card.is-selected input:not([type=file])')?.focus(),
              );
            }}
          >
            <span className="toolbar__icon" aria-hidden>
              {info.icon}
            </span>
            <span>{info.name}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function ZoomControls() {
  const zoom = useBoard((s) => s.project.viewport.zoom);
  return (
    <div className="zoom" aria-label="Zoom">
      <button onClick={() => zoomBy(1 / 1.2, canvasSize())} aria-label="Zoom out">
        −
      </button>
      <span>{Math.round(zoom * 100)}%</span>
      <button onClick={() => zoomBy(1.2, canvasSize())} aria-label="Zoom in">
        +
      </button>
      <button onClick={() => fitToCards(canvasSize())} title="Show everything">
        ⤢
      </button>
    </div>
  );
}
