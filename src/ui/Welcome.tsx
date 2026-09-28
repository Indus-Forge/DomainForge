import type { ReactNode } from 'react';
import { BookOpen, Clapperboard, Image as ImageIcon, MessageCircle, Microscope, Sparkles, Zap } from 'lucide-react';
import { useBoard } from '../store/board';
import { findPlan } from '../ai/producer';
import { placeExample } from '../canvas/example';
import { canvasSize, fitToCards, viewCenter } from '../canvas/Canvas';

const STARTS: { label: string; asks: string; icon: ReactNode }[] = [
  { label: 'A story', asks: 'a story', icon: <BookOpen size={22} /> },
  { label: 'A comic', asks: 'a comic', icon: <Zap size={22} /> },
  { label: 'A poster', asks: 'a poster', icon: <ImageIcon size={22} /> },
  { label: 'A video', asks: 'a video', icon: <Clapperboard size={22} /> },
  { label: 'A fact file', asks: 'a documentary', icon: <Microscope size={22} /> },
];

/**
 * The start wizard, shown on an empty board: one question, big answers. A
 * choice lays out a plan on the board and the Producer says what to do first,
 * so nobody is left staring at an empty screen.
 */
export function Welcome({ onOpenProducer }: { onOpenProducer(focus: boolean): void }) {
  const empty = useBoard((s) => s.project.cards.length === 0);
  if (!empty) return null;

  const start = (label: string, asks: string) => {
    const plan = findPlan(`I want to make ${asks}`);
    if (!plan) return;
    // Open the Producer first, so the plan is fitted into the space that's left.
    onOpenProducer(false);
    requestAnimationFrame(() => {
      const ids = useBoard.getState().placePlan(plan, viewCenter());
      useBoard.getState().select(ids[0]);
      fitToCards(canvasSize());
      const [main, ...rest] = plan.steps;
      document.dispatchEvent(
        new CustomEvent('workshop:producer-say', {
          detail:
            `Great, let’s make ${label.toLowerCase()}! I’ve put a plan on your board.\n\n` +
            `1. Start with the card in the middle, “${main.title}”: ${main.hint}\n` +
            `2. Then fill in the cards around it: ${rest.filter((s) => s.kind !== 'tool').map((s) => s.title).join(', ') || 'add anything you like'}.\n` +
            `3. When you’re ready, press “Make a picture” on your idea.\n\n` +
            'Every line you connect tells the AI more about what you mean.',
        }),
      );
      requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.card.is-selected textarea')?.focus());
    });
  };

  return (
    <div className="welcome">
      <h1>What shall we make today?</h1>
      <p>Pick one and I’ll set up your board. You fill in the ideas, and the AI follows your connections.</p>
      <div className="welcome__starts">
        {STARTS.map((s) => (
          <button key={s.label} className="start" onClick={() => start(s.label, s.asks)}>
            <span className="start__icon" aria-hidden>
              {s.icon}
            </span>
            {s.label}
          </button>
        ))}
      </div>
      <div className="welcome__actions">
        <button className="button button--quiet" onClick={() => placeExample(viewCenter())}>
          <Sparkles size={16} /> Show me an example
        </button>
        <button className="button button--quiet" onClick={() => onOpenProducer(true)}>
          <MessageCircle size={16} /> Something else: tell the Producer
        </button>
      </div>
      <p className="muted">Or double-click anywhere to write your own idea.</p>
    </div>
  );
}
