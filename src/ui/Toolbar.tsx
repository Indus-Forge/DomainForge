import { CARD_INFO } from '../model/cards';
import type { CardKind } from '../model/types';
import { useBoard } from '../store/board';
import { addPictureFiles, bringCardsIntoView, canvasSize, fitToCards, viewCenter, zoomBy } from '../canvas/Canvas';
import { useEffect, useRef, useState } from 'react';
import { addTool, TOOL_ORDER, TOOLS } from '../tools/tools';

const ADDABLE = (Object.keys(CARD_INFO) as CardKind[]).filter((k) => CARD_INFO[k].addable);

export function Toolbar() {
  const addCard = useBoard.getState().addCard;
  const files = useRef<HTMLInputElement>(null);
  return (
    <nav className="toolbar" aria-label="Add to your board">
      <input
        ref={files}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          addPictureFiles(Array.from(e.target.files ?? []), viewCenter());
          e.target.value = '';
        }}
      />
      {ADDABLE.map((kind) => {
        const info = CARD_INFO[kind];
        return (
          <button
            key={kind}
            className="toolbar__item"
            title={info.hint}
            onClick={() => {
              // Pictures go straight to the file chooser: that's what people expect.
              if (kind === 'picture') return files.current?.click();
              const c = viewCenter();
              const jitter = () => Math.round((Math.random() - 0.5) * 80);
              bringCardsIntoView([addCard(kind, { x: c.x + jitter(), y: c.y + jitter() })]);
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
      <ToolsTray />
    </nav>
  );
}

function ToolsTray() {
  const [open, setOpen] = useState(false);
  const tray = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !tray.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);
  return (
    <div className="tools-tray" ref={tray}>
      <button className="toolbar__item" aria-expanded={open} onClick={() => setOpen(!open)} title="Tools that take what you connect and make something new">
        <span className="toolbar__icon" aria-hidden>
          🧰
        </span>
        <span>Tools</span>
      </button>
      {open && (
        <div className="tools-tray__list" role="menu">
          <p className="tools-tray__title">Add a tool. Connect cards to it, then press Run.</p>
          {TOOL_ORDER.map((id) => (
            <button
              key={id}
              role="menuitem"
              onClick={() => {
                const c = viewCenter();
                addTool(id, c);
                setOpen(false);
              }}
            >
              <span aria-hidden>{TOOLS[id].icon}</span>
              <span>
                <strong>{TOOLS[id].name}</strong>
                <small>Makes {TOOLS[id].makes}</small>
              </span>
            </button>
          ))}
          <p className="tools-tray__more">Video, music and web search tools are coming in a later version.</p>
        </div>
      )}
    </div>
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
