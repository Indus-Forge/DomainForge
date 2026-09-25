import { memo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Card } from '../model/types';
import { CARD_INFO } from '../model/cards';
import { useBoard } from '../store/board';
import { describePicture } from '../ai/privateAI';
import { readImageFile } from './images';

interface Props {
  card: Card;
  selected: boolean;
  zoom: number;
  onStartLink(cardId: string, e: ReactPointerEvent): void;
}

const INTERACTIVE = 'textarea, input, button, label, select, a';

function CardViewInner({ card, selected, zoom, onStartLink }: Props) {
  const info = CARD_INFO[card.kind];
  const { updateCard, deleteCard, select, checkpoint, openRecipe } = useBoard.getState();

  const drag = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number; mode: 'move' | 'resize' } | null>(null);

  const begin = (e: ReactPointerEvent<HTMLElement>, mode: 'move' | 'resize') => {
    if (e.button !== 0) return;
    if (mode === 'move' && (e.target as HTMLElement).closest(INTERACTIVE)) {
      select(card.id);
      return;
    }
    e.stopPropagation();
    select(card.id);
    checkpoint();
    drag.current = { px: e.clientX, py: e.clientY, x: card.x, y: card.y, w: card.w, h: card.h, mode };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.px) / zoom;
    const dy = (e.clientY - d.py) / zoom;
    if (d.mode === 'move') updateCard(card.id, { x: Math.round(d.x + dx), y: Math.round(d.y + dy) });
    else updateCard(card.id, { w: Math.max(160, Math.round(d.w + dx)), h: Math.max(110, Math.round(d.h + dy)) });
  };

  const end = () => {
    drag.current = null;
  };

  return (
    <div
      className={`card card--${card.kind}${selected ? ' is-selected' : ''}${card.status === 'working' ? ' is-working' : ''}`}
      data-card-id={card.id}
      style={{ left: card.x, top: card.y, width: card.w, height: card.h }}
      onPointerDown={(e) => begin(e, 'move')}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label={`${info.name} card`}
    >
      <div className="card__kind" aria-hidden>
        <span>{info.icon}</span> {info.name}
      </div>

      <CardBody card={card} />

      {selected && info.canCreateFrom && (
        <button className="card__create" onClick={() => openRecipe({ cardId: card.id, mode: 'preview' })}>
          ✨ Make a picture
        </button>
      )}

      {selected && (
        <button className="card__delete" title="Remove this card" aria-label="Remove this card" onClick={() => deleteCard(card.id)}>
          ×
        </button>
      )}

      <button
        className="card__knob"
        title="Drag me onto another card to connect them"
        aria-label="Connect this card to another"
        onPointerDown={(e) => {
          e.stopPropagation();
          onStartLink(card.id, e);
        }}
      />
      <div className="card__resize" onPointerDown={(e) => begin(e, 'resize')} aria-hidden />
    </div>
  );
}

function CardBody({ card }: { card: Card }) {
  const info = CARD_INFO[card.kind];
  const { updateCard, checkpoint } = useBoard.getState();
  const edit = (patch: Partial<Card>) => updateCard(card.id, patch);

  switch (card.kind) {
    case 'idea':
    case 'note':
      return (
        <div className="card__body">
          {card.title && <div className="card__heading">{card.title}</div>}
          <textarea
            className="card__text"
            value={card.text}
            placeholder={card.hint ?? info.placeholder}
            onFocus={checkpoint}
            onChange={(e) => edit({ text: e.target.value })}
          />
        </div>
      );
    case 'character':
    case 'style':
      return (
        <div className="card__body">
          <input
            className="card__title"
            value={card.title ?? ''}
            placeholder={card.kind === 'character' ? 'Name' : 'Name this style'}
            onFocus={checkpoint}
            onChange={(e) => edit({ title: e.target.value })}
          />
          <textarea
            className="card__text"
            value={card.text}
            placeholder={card.hint ?? info.placeholder}
            onFocus={checkpoint}
            onChange={(e) => edit({ text: e.target.value })}
          />
        </div>
      );
    case 'picture':
      return <PictureBody card={card} />;
    case 'creation':
      return <CreationBody card={card} />;
  }
}

function PictureBody({ card }: { card: Card }) {
  const { updateCard, checkpoint, learn } = useBoard.getState();
  const privateAI = useBoard((s) => s.privateAI);
  const [looking, setLooking] = useState(false);
  const [problem, setProblem] = useState('');

  const choose = async (file?: File) => {
    if (!file) return;
    try {
      checkpoint();
      const { image, ratio } = await readImageFile(file);
      updateCard(card.id, { image, h: Math.round(card.w * Math.min(ratio, 1.4)) + 64 });
    } catch (err) {
      setProblem((err as Error).message);
    }
  };

  const describe = async () => {
    if (!card.image) return;
    setLooking(true);
    setProblem('');
    try {
      const text = await describePicture(privateAI, card.image);
      checkpoint();
      updateCard(card.id, { text });
      learn('described-picture');
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setLooking(false);
    }
  };

  if (!card.image) {
    return (
      <label className="card__drop">
        <input type="file" accept="image/*" hidden onChange={(e) => choose(e.target.files?.[0])} />
        <span className="card__drop-icon">🖼️</span>
        {card.title && <strong>{card.title}</strong>}
        <span>{card.hint ?? 'Click to choose a picture, or drop one onto the board.'}</span>
        {problem && <span className="card__problem">{problem}</span>}
      </label>
    );
  }

  return (
    <div className="card__body card__body--picture">
      <img className="card__image" src={card.image} alt={card.text || 'A picture you added'} draggable={false} />
      <div className="card__caption-row">
        <input
          className="card__caption"
          value={card.text}
          placeholder={CARD_INFO.picture.placeholder}
          onFocus={checkpoint}
          onChange={(e) => updateCard(card.id, { text: e.target.value })}
        />
        {privateAI.visionModel && (
          <button className="chip" onClick={describe} disabled={looking} title="Let your assistant look at the picture and describe it">
            {looking ? 'Looking…' : '✨ Describe'}
          </button>
        )}
      </div>
      {problem && <span className="card__problem">{problem}</span>}
    </div>
  );
}

function CreationBody({ card }: { card: Card }) {
  const openRecipe = useBoard.getState().openRecipe;
  if (card.status === 'working') {
    return (
      <div className="card__working">
        <div className="shimmer" />
        <p>Creating your picture…</p>
        <small>Reading the recipe your board made.</small>
      </div>
    );
  }
  if (card.status === 'error') {
    return (
      <div className="card__working">
        <p>That didn’t work this time.</p>
        <small>{card.statusMessage}</small>
      </div>
    );
  }
  const isSketch = card.recipe?.madeWith === 'Sketch preview';
  return (
    <div className="card__body card__body--picture">
      {card.image && <img className="card__image" src={card.image} alt={card.recipe?.description ?? 'A creation'} draggable={false} />}
      {isSketch && <span className="card__badge">Sketch</span>}
      <button className="card__how" onClick={() => openRecipe({ cardId: card.id, mode: 'made' })}>
        🔍 How this was made
      </button>
    </div>
  );
}

export const CardView = memo(CardViewInner);
