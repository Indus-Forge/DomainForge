import { useState } from 'react';
import type { Card } from '../model/types';
import { useBoard } from '../store/board';
import { saveFile } from '../platform';

/** A video card: plays the video, saves it as a file, and says how it was made. */
export function VideoBody({ card }: { card: Card }) {
  const name = useBoard((s) => s.project.name);
  const [note, setNote] = useState('');
  const info = card.videoInfo;

  const save = async () => {
    if (!card.video || !info) return;
    setNote('');
    try {
      const blob = await (await fetch(card.video)).blob();
      const saved = await saveFile(`${name.replace(/[^\w\- ]+/g, '').trim() || 'video'}.${info.format}`, blob);
      if (saved) setNote('Saved.');
    } catch (err) {
      setNote(`Couldn’t save: ${(err as Error).message}`);
    }
  };

  return (
    <div className="card__body card__body--picture">
      {card.video && <video className="card__video" src={card.video} poster={info?.poster} controls playsInline preload="metadata" />}
      <div className="card__caption-row">
        <button className="button button--small button--primary" onClick={save}>
          💾 Save video
        </button>
        {info && (
          <span className="card__made-by">
            {Math.round(info.seconds)} seconds · {info.format.toUpperCase()}
          </span>
        )}
      </div>
      {note && <div className="card__made-by">{note}</div>}
      {info?.plan && (
        <button className="card__how" onClick={() => useBoard.getState().openRecipe({ cardId: card.id, mode: 'made' })}>
          🔍 How this was edited
        </button>
      )}
    </div>
  );
}

/** Names a point in a picture in everyday words: "the top left", "the centre". */
export function describeSpot(x: number, y: number): string {
  const across = x < 0.38 ? 'left' : x > 0.62 ? 'right' : '';
  const down = y < 0.38 ? 'top' : y > 0.62 ? 'bottom' : '';
  if (!across && !down) return 'the centre';
  return `the ${[down, across].filter(Boolean).join(' ')}`;
}
