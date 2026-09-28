import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../store/board';
import { findPictureRequest, findPlan, planReply, PRODUCER_PERSONA, type Plan } from '../ai/producer';
import { ASSISTANT_NAMES, converse, useAssistant } from '../ai/assistant';
import { describeBoard } from '../ai/recipe';
import { ASK_TEACHER, choosePictureMaker } from '../ai/create';
import { classroomProblem, forClass, SAFETY_MESSAGES } from '../ai/safety';
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
  text: 'Hi, I’m your Producer. Tell me what you’d like to make, and I’ll help you plan it on your board.\n\nFor example: “I want to make a comic about a dragon who’s scared of the dark.”',
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
  const assistant = useAssistant();
  const project = useBoard((s) => s.project);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  // Other parts of the app (the start wizard) can speak through the Producer.
  useEffect(() => {
    const say = (e: Event) => setMessages((ms) => [...ms, { from: 'producer', text: (e as CustomEvent<string>).detail }]);
    document.addEventListener('workshop:producer-say', say);
    return () => document.removeEventListener('workshop:producer-say', say);
  }, []);

  const say = async () => {
    const text = draft.trim();
    if (!text || thinking) return;
    setDraft('');
    const history = [...messages, { from: 'you' as const, text }];
    setMessages(history);
    const classroom = useBoard.getState().settings.classroom;

    const unsuitable = classroom && classroomProblem(text);
    if (unsuitable) {
      setMessages([...history, { from: 'producer', text: SAFETY_MESSAGES[unsuitable] }]);
      return;
    }

    // "Make me a picture of…": do it, on the board, and show how.
    const subject = findPictureRequest(text);
    if (subject) {
      const { addCard, openRecipe } = useBoard.getState();
      const id = addCard('idea', viewCenter(), { text: subject });
      bringCardsIntoView([id]);
      openRecipe({ cardId: id, mode: 'preview' });
      const real = choosePictureMaker() !== null;
      setMessages([
        ...history,
        {
          from: 'producer',
          text:
            `I’ve put “${subject}” on your board as an idea, and opened the recipe so you can see exactly what the AI will read.\n\n` +
            (real
              ? 'Press Create picture. Tip: add a Style card and connect it to your idea to change how the picture looks.'
              : classroom
                ? ASK_TEACHER
                : 'No picture model is connected yet, so I can’t make the picture. Press “Connect a picture model” and add a free Hugging Face token; then Create picture makes it for real.'),
        },
      ]);
      return;
    }

    const plan = findPlan(text);
    if (plan) {
      setMessages([...history, { from: 'producer', text: planReply(plan), plan }]);
      return;
    }
    if (!assistant.kind) {
      setMessages([
        ...history,
        {
          from: 'producer',
          text:
            'I can’t chat freely yet, but I can still help! Ask me for a picture (“make a picture of a dog on the moon”) or tell me about a bigger project (“I want to make a comic”).' +
            (classroom ? '' : ' Open Admin to switch on the assistant.'),
        },
      ]);
      return;
    }

    setThinking(true);
    const instructions = `${PRODUCER_PERSONA}\n\nHere is the person's board right now:\n${describeBoard(project)}`;
    const turns = history.slice(1).map((m) => ({ role: m.from === 'you' ? ('user' as const) : ('assistant' as const), content: m.text }));
    let reply = '';
    try {
      for await (const piece of converse(instructions, turns)) {
        reply += piece;
        // In classroom mode the answer is checked before anyone sees it, so it isn't shown word by word.
        if (!classroom) setMessages([...history, { from: 'producer', text: reply }]);
      }
      if (classroom) {
        setMessages([
          ...history,
          { from: 'producer', text: classroomProblem(reply) ? 'Hmm, my answer wasn’t right for school, so I’ve hidden it. Let’s try a different idea!' : reply },
        ]);
      }
    } catch (err) {
      const why = forClass((err as Error).message, classroom);
      setMessages([...history, { from: 'producer', text: reply && !classroom ? `${reply}\n\n(${why})` : why }]);
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
                {m.placed ? '✓ Placed on your board' : 'Place these on my board'}
              </button>
            )}
          </div>
        ))}
        {thinking && messages.at(-1)?.from === 'you' && <div className="message message--producer typing">Thinking…</div>}
        {assistant.kind && !assistant.isPrivate && <p className="online-note">Chatting with {ASSISTANT_NAMES[assistant.kind]}.</p>}
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
        <summary>What your Producer can see</summary>
        <p className="muted">
          This is everything your assistant is told about your board. Nothing is hidden.{' '}
          {assistant.kind && !assistant.isPrivate ? 'It is sent to the online service when you chat.' : 'With a private assistant, nothing leaves this computer.'}
        </p>
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
          <h4>{TIPS[e].title}</h4>
          <p>{TIPS[e].body}</p>
        </article>
      ))}
      {remaining > 0 && (
        <p className="discovery discovery--locked">
          {remaining} more to discover. Try connecting different cards, adding pictures, or asking the Producer for a plan.
        </p>
      )}
    </div>
  );
}

export type { Tab };
