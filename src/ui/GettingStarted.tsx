import { useState } from 'react';
import { Check } from 'lucide-react';
import { useBoard } from '../store/board';
import { choosePictureMaker } from '../ai/create';

const KEY = 'workshop:getting-started-hidden';

function hiddenBefore() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * A small checklist that follows the success criteria for a beginner and
 * ticks itself as they go. It disappears once they have done it all.
 */
export function GettingStarted() {
  const cards = useBoard((s) => s.project.cards);
  const links = useBoard((s) => s.project.links);
  const discovered = useBoard((s) => s.discovered);
  // Re-check the picture model whenever a connection changes.
  useBoard((s) => s.studio);
  useBoard((s) => s.hf);
  useBoard((s) => s.settings);
  const hasPictureModel = choosePictureMaker() !== null;
  const [hidden, setHidden] = useState(hiddenBefore);
  // Starts folded on phones, where the board needs the room.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 700);

  const openHub = () => useBoard.getState().setHubOpen(true);
  const steps: { done: boolean; text: string; how: string; action?: { label: string; run(): void } }[] = [
    {
      done: hasPictureModel,
      text: 'Connect a picture model',
      how: 'Add a free Hugging Face token in Admin. It takes about a minute.',
      action: { label: 'Open Admin', run: openHub },
    },
    { done: cards.some((c) => (c.kind === 'idea' || c.kind === 'note') && c.text.trim()), text: 'Write an idea', how: 'Double-click the board, or press Idea.' },
    {
      done: cards.some((c) => (c.kind === 'picture' && c.image) || ((c.kind === 'character' || c.kind === 'style') && (c.text || c.title))),
      text: 'Add a picture, character or style',
      how: 'Use the buttons on the left, or drop a photo on the board.',
    },
    { done: links.some((l) => l.kind !== 'origin'), text: 'Connect them', how: 'Click a card, press Connect, then click the other card.' },
    {
      done: cards.some((c) => c.kind === 'creation' && c.image && (c.recipe?.how ?? 'studio') === 'studio'),
      text: 'Make a picture',
      how: 'Press Make a picture under your idea.',
    },
    { done: discovered.includes('recipe-opened'), text: 'See how the AI read your board', how: 'Press How this was made on your creation.' },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  if (hidden || cards.length === 0) return null;

  const hide = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Hidden for this visit only.
    }
  };

  if (!next) {
    return (
      <aside className="getting-started is-done" aria-live="polite">
        <strong>You made something with AI, and saw exactly how it worked.</strong>
        <p>Next, try the Tools, or ask the Producer to help plan a bigger project.</p>
        <button className="button button--small" onClick={hide}>
          Close
        </button>
      </aside>
    );
  }

  return (
    <aside className="getting-started" aria-label="Getting started">
      <button className="getting-started__head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <strong>Getting started</strong>
        <span className="count">
          {doneCount} of {steps.length}
        </span>
        <span aria-hidden>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <>
          <ol>
            {steps.map((s) => (
              <li key={s.text} className={s.done ? 'is-done' : s === next ? 'is-next' : ''}>
                <span aria-hidden>{s.done ? <Check size={11} strokeWidth={3} /> : null}</span>
                <div>
                  {s.text}
                  {s === next && <small>{s.how}</small>}
                  {s === next && s.action && (
                    <button className="link-button" onClick={s.action.run}>
                      {s.action.label}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <button className="getting-started__hide" onClick={hide}>
            Hide this
          </button>
        </>
      )}
    </aside>
  );
}
