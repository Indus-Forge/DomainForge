import { useState } from 'react';
import type { Card } from '../model/types';
import { CARD_INFO } from '../model/cards';
import { useBoard } from '../store/board';
import { useAssistant } from '../ai/assistant';
import { gatherConnected } from '../ai/recipe';
import { runTool, stopSpeaking, TOOLS } from './tools';

/** The face of a workflow tile: what it takes, what it does, what it makes, and a Run button. */
export function ToolBody({ card }: { card: Card }) {
  const info = card.tool ? TOOLS[card.tool] : undefined;
  const assistant = useAssistant();
  const connected = useBoard((s) => {
    const inputs = gatherConnected(s.project, card.id)
      .slice(1)
      .map((v) => v.card)
      .filter((c) => c.kind !== 'tool');
    const counts = new Map<string, number>();
    for (const c of inputs) counts.set(CARD_INFO[c.kind].name, (counts.get(CARD_INFO[c.kind].name) ?? 0) + 1);
    return [...counts].map(([name, n]) => (n > 1 ? `${n} ${name.toLowerCase()}s` : name.toLowerCase())).join(', ');
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState(false);
  if (!info) return null;

  const blocked = info.needsAssistant && !assistant.kind;

  const run = async () => {
    setBusy(true);
    setProblem(false);
    setMessage(info.needsAssistant ? 'Working… this can take up to a minute.' : 'Working…');
    try {
      setMessage(await runTool(card.id, setMessage));
    } catch (err) {
      setProblem(true);
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card__body tool">
      <div className="tool__name">
        <span aria-hidden>{info.icon}</span> {info.name}
      </div>
      <ol className="tool__flow">
        <li>
          <b>Takes</b> {info.takes}
        </li>
        <li>
          <b>Does</b> {info.does}
        </li>
        <li>
          <b>Makes</b> {info.makes}
        </li>
      </ol>
      <div className="tool__inputs">{connected ? `Connected: ${connected}` : 'Nothing connected yet. Drag a card’s dot onto this tile.'}</div>
      <div className="tool__actions">
        <button className="button button--primary button--small" onClick={run} disabled={busy || blocked}>
          {busy ? 'Working…' : card.tool === 'voice' ? '▶ Read aloud' : '▶ Run'}
        </button>
        {card.tool === 'voice' && (
          <button className="button button--quiet button--small" onClick={() => { stopSpeaking(); setMessage(''); }}>
            ■ Stop
          </button>
        )}
      </div>
      {blocked && <div className="tool__message">Needs an assistant. See “Your AI”.</div>}
      {message && <div className={`tool__message${problem ? ' is-problem' : ''}`}>{message}</div>}
    </div>
  );
}
