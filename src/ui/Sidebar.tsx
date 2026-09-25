import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../store/board';
import { findPlan, planReply, PRODUCER_PERSONA, type Plan } from '../ai/producer';
import { chat, type ChatMessage } from '../ai/privateAI';
import { describeBoard } from '../ai/recipe';
import { TIPS, type LearnEvent } from '../learn/tips';
import { bringCardsIntoView, viewCenter } from '../canvas/Canvas';
import { YourAI } from './YourAI';

type Tab = 'producer' | 'discoveries' | 'ai';

interface Message {
  from: 'you' | 'producer';
  text: string;
  plan?: Plan;
  placed?: boolean;
}

const GREETING: Message = {
  from: 'producer',
  text: 'Hi, I’m your Producer. Tell me what you’d like to make, and I’ll help you plan it on your board.\n\nFor example: “I want to make a documentary about bees.”',
};

export function Sidebar({ tab, setTab }: { tab: Tab; setTab(t: Tab): void }) {
  const open = useBoard((s) => s.sidebarOpen);
  const discovered = useBoard((s) => s.discovered);
  if (!open) return null;
  return (
    <aside className="sidebar" aria-label="Assistant">
      <nav className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'producer'} onClick={() => setTab('producer')}>
          Producer
        </button>
        <button role="tab" aria-selected={tab === 'discoveries'} onClick={() => setTab('discoveries')}>
          Discoveries <span className="count">{discovered.length}</span>
        </button>
        <button role="tab" aria-selected={tab === 'ai'} onClick={() => setTab('ai')}>
          Your AI
        </button>
      </nav>
      {tab === 'producer' && <Producer />}
      {tab === 'discoveries' && <Discoveries />}
      {tab === 'ai' && <YourAI />}
    </aside>
  );
}

function Producer() {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const privateAI = useBoard((s) => s.privateAI);
  const project = useBoard((s) => s.project);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  const say = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft('');
    const history = [...messages, { from: 'you' as const, text }];
    setMessages(history);

    const plan = findPlan(text);
    if (plan) {
      setMessages([...history, { from: 'producer', text: planReply(plan), plan }]);
      return;
    }
    if (!privateAI.online) {
      setMessages([
        ...history,
        {
          from: 'producer',
          text: 'My private assistant isn’t switched on yet, so I can’t chat freely. I can still help you plan: tell me what you’d like to make, like “I want to make a comic” or “help me plan a lesson”.',
        },
      ]);
      return;
    }

    setThinking(true);
    const convo: ChatMessage[] = [
      { role: 'system', content: `${PRODUCER_PERSONA}\n\nHere is the person's board right now:\n${describeBoard(project)}` },
      ...history.slice(1).map((m) => ({ role: m.from === 'you' ? ('user' as const) : ('assistant' as const), content: m.text })),
    ];
    let reply = '';
    try {
      for await (const piece of chat(privateAI, convo)) {
        reply += piece;
        setMessages([...history, { from: 'producer', text: reply }]);
      }
    } catch (err) {
      setMessages([...history, { from: 'producer', text: `Sorry, I lost my train of thought. ${(err as Error).message}` }]);
    } finally {
      setThinking(false);
    }
  };

  const place = (index: number, plan: Plan) => {
    bringCardsIntoView(useBoard.getState().placePlan(plan, viewCenter()));
    setMessages((ms) => ms.map((m, i) => (i === index ? { ...m, placed: true } : m)));
  };

  return (
    <div className="producer">
      <div className="messages">
        {messages.map((m, i) => (
          <div key={i} className={`message message--${m.from}`}>
            <p>{m.text}</p>
            {m.plan && (
              <button className="button button--primary button--small" disabled={m.placed} onClick={() => place(i, m.plan!)}>
                {m.placed ? '✓ Placed on your board' : '📌 Place these on my board'}
              </button>
            )}
          </div>
        ))}
        {thinking && messages.at(-1)?.from === 'you' && <div className="message message--producer typing">Thinking…</div>}
        <div ref={end} />
      </div>
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          say();
        }}
      >
        <textarea
          value={draft}
          placeholder="Tell me what you’d like to make…"
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              say();
            }
          }}
        />
        <button className="button button--primary" disabled={!draft.trim() || thinking}>
          Send
        </button>
      </form>
      <details className="sees">
        <summary>👀 What your Producer can see</summary>
        <p className="muted">This is everything your assistant is told about your board. Nothing is hidden, and nothing leaves this computer.</p>
        <pre>{describeBoard(project)}</pre>
      </details>
    </div>
  );
}

function Discoveries() {
  const discovered = useBoard((s) => s.discovered);
  const remaining = Object.keys(TIPS).length - discovered.length;
  return (
    <div className="discoveries">
      <p className="muted">Things you’ve learned about AI by building. New ones appear as you try things out.</p>
      {[...discovered].reverse().map((e: LearnEvent) => (
        <article key={e} className="discovery">
          <h4>💡 {TIPS[e].title}</h4>
          <p>{TIPS[e].body}</p>
        </article>
      ))}
      {remaining > 0 && (
        <p className="discovery discovery--locked">
          🔒 {remaining} more to discover. Try connecting different cards, adding pictures, or asking the Producer for a plan.
        </p>
      )}
    </div>
  );
}

export type { Tab };
