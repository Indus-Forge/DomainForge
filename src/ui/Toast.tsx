import { useEffect } from 'react';
import { useBoard } from '../store/board';
import { TIPS } from '../learn/tips';

/** A new discovery, shown gently and only once. */
export function Toast() {
  const current = useBoard((s) => s.toasts[0]);
  const dismiss = useBoard.getState().dismissToast;

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(dismiss, 10000);
    return () => clearTimeout(t);
  }, [current, dismiss]);

  if (!current) return null;
  const tip = TIPS[current];
  return (
    <div className="toast" role="status" key={current}>
      <div className="toast__label">💡 New discovery</div>
      <h4>{tip.title}</h4>
      <p>{tip.body}</p>
      <button className="button button--quiet button--small" onClick={dismiss}>
        Got it
      </button>
    </div>
  );
}
