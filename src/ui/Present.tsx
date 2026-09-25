import { useEffect, useMemo, useState } from 'react';
import { useBoard } from '../store/board';
import { CARD_INFO } from '../model/cards';
import { creationsFrom, presentationOrder } from '../ai/recipe';
import { speak, stopSpeaking } from '../tools/tools';

/** Shows the board as slides, following its "then" connections. */
export function Present() {
  const presenting = useBoard((s) => s.presenting);
  const project = useBoard((s) => s.project);
  const { setPresenting, learn } = useBoard.getState();
  const slides = useMemo(() => presentationOrder(project), [project]);
  const [index, setIndex] = useState(0);
  const [aloud, setAloud] = useState(false);

  const slide = slides[Math.min(index, slides.length - 1)];
  const picture = slide
    ? slide.image && (slide.kind === 'picture' || slide.kind === 'creation')
      ? slide.image
      : creationsFrom(project, slide.id).at(-1)?.image
    : undefined;
  const words = slide ? (slide.kind === 'creation' ? slide.recipe?.sent ?? '' : slide.text) : '';

  useEffect(() => {
    if (!presenting) return;
    setIndex(0);
    learn('presented');
  }, [presenting, learn]);

  useEffect(() => {
    if (!presenting) return stopSpeaking();
    if (aloud && words) speak(words);
    return () => stopSpeaking();
  }, [presenting, aloud, words]);

  useEffect(() => {
    if (!presenting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setIndex((i) => Math.min(i + 1, slides.length - 1));
      else if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0));
      else if (e.key === 'Escape') setPresenting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting, slides.length, setPresenting]);

  if (!presenting) return null;

  return (
    <div className="present" role="dialog" aria-modal="true" aria-label="Presenting your board">
      <header className="present__bar">
        <strong>{project.name}</strong>
        <span className="muted">{slides.length ? `${index + 1} of ${slides.length}` : ''}</span>
        <label className="present__aloud">
          <input type="checkbox" checked={aloud} onChange={(e) => setAloud(e.target.checked)} /> 🗣️ Read aloud
        </label>
        <button className="button button--quiet button--small" onClick={() => setPresenting(false)}>
          Close
        </button>
      </header>
      {slide ? (
        <main className="present__slide">
          {picture && <img src={picture} alt="" />}
          <div className="present__words">
            <div className="present__kind">
              {CARD_INFO[slide.kind].icon} {slide.title || CARD_INFO[slide.kind].name}
            </div>
            <p>{words || (picture ? '' : 'This card is still empty.')}</p>
          </div>
        </main>
      ) : (
        <main className="present__slide present__slide--empty">
          <p>
            Nothing to present yet. Connect cards with “then” (the Producer and the Storyboard Creator do this for you), or make
            some pictures.
          </p>
        </main>
      )}
      {slides.length > 1 && (
        <footer className="present__nav">
          <button className="button button--quiet" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>
            ← Back
          </button>
          <button className="button button--primary" onClick={() => setIndex(Math.min(slides.length - 1, index + 1))} disabled={index >= slides.length - 1}>
            Next →
          </button>
        </footer>
      )}
    </div>
  );
}
