import { useBoard } from '../store/board';
import { placeExample } from '../canvas/example';
import { viewCenter } from '../canvas/Canvas';

/** Shown on an empty board. */
export function Welcome({ onAskProducer }: { onAskProducer(): void }) {
  const empty = useBoard((s) => s.project.cards.length === 0);
  if (!empty) return null;
  return (
    <div className="welcome">
      <h1>Build ideas, not prompts.</h1>
      <p>
        This is your board. Put ideas, pictures and notes anywhere, then connect them. Your connections tell the AI what you mean,
        and you can always see exactly how.
      </p>
      <div className="welcome__actions">
        <button className="button button--primary" onClick={() => placeExample(viewCenter())}>
          🚀 Try an example
        </button>
        <button className="button button--quiet" onClick={onAskProducer}>
          🎬 Plan something with the Producer
        </button>
      </div>
      <p className="muted">Or double-click anywhere to write your first idea.</p>
    </div>
  );
}
