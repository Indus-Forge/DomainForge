import { useEffect, useState } from 'react';
import { useBoard } from '../store/board';
import { checkPrivateAI, installModel, removeModel } from '../ai/privateAI';
import { checkImageStudio } from '../ai/imageEngine';
import { checkOnlineAI } from '../ai/onlineAI';
import { useAssistant } from '../ai/assistant';
import {
  CATALOGUE,
  catalogueEntry,
  describeComputer,
  FIT_WORDS,
  fitFor,
  friendlySize,
  lastUsed,
  tidySuggestions,
  type ComputerInfo,
} from '../ai/models';
import { askToConfirm, getComputerInfo } from '../platform';

export async function refreshAI() {
  const { setPrivateAI, setStudio, setOnlineAI } = useBoard.getState();
  const [ai, studio, online] = await Promise.all([checkPrivateAI(), checkImageStudio(), checkOnlineAI()]);
  setPrivateAI(ai);
  setStudio(studio);
  setOnlineAI(online);
}

/** What AI is available, described in everyday words. */
export function YourAI() {
  const privateAI = useBoard((s) => s.privateAI);
  const onlineAI = useBoard((s) => s.onlineAI);
  const studio = useBoard((s) => s.studio);
  const settings = useBoard((s) => s.settings);
  const assistant = useAssistant();
  const [checking, setChecking] = useState(false);

  return (
    <div className="your-ai">
      <p className={`promise ${assistant.kind === 'online' ? 'promise--online' : ''}`}>
        {assistant.kind === 'online' ? (
          <>
            <strong>You’re using the online assistant.</strong>
            <br />
            Your boards stay in this browser, but what you ask the assistant is sent to Claude to be answered. In the desktop
            app, a private assistant can run on your own computer instead.
          </>
        ) : (
          <>
            <strong>Your AI. Your computer. Your ideas.</strong>
            <br />
            Everything here runs on this computer. Your boards and pictures are never uploaded.
          </>
        )}
      </p>

      <article className={`service ${privateAI.online ? 'is-on' : ''}`}>
        <h4>{privateAI.online ? '🟢' : '⚪'} Personal AI Assistant</h4>
        <p>
          {privateAI.online
            ? privateAI.chatModel
              ? 'Ready, on this computer. Your Producer can chat, plan and smooth your wording.'
              : 'Running, but no assistant is installed yet. Add one from the library below.'
            : 'Not running on this computer.'}
        </p>
        {privateAI.online && privateAI.chatModel && (
          <p className="muted">{privateAI.visionModel ? 'It can also look at your pictures and describe them.' : 'It can’t look at pictures yet.'}</p>
        )}
      </article>

      {onlineAI.available && (
        <article className={`service ${assistant.kind === 'online' ? 'is-online' : ''}`}>
          <h4>{assistant.kind === 'online' ? '🌐' : '⚪'} Online assistant (Claude)</h4>
          <p>
            {settings.educatorMode
              ? 'Switched off by educator mode.'
              : privateAI.online && privateAI.chatModel
                ? 'Available, but not used: your private assistant comes first.'
                : 'In use, because no private assistant was found. It can chat, write, describe pictures and draw illustrations.'}
          </p>
        </article>
      )}

      <article className={`service ${studio.online ? 'is-on' : ''}`}>
        <h4>{studio.online ? '🟢' : '⚪'} Image studio</h4>
        <p>
          {studio.online
            ? 'Ready. Your pictures are made on this computer.'
            : assistant.canDraw
              ? 'Not set up. The online assistant draws illustrations instead.'
              : 'Not set up yet. Pictures are shown as sketch previews for now.'}
        </p>
      </article>

      <label className="toggle">
        <input
          type="checkbox"
          checked={settings.educatorMode}
          onChange={(e) => useBoard.getState().setSettings({ educatorMode: e.target.checked })}
        />
        <span>
          <strong>Educator mode: keep everything on this computer</strong>
          <small>Never uses online AI. Ideal for classrooms.</small>
        </span>
      </label>

      <button
        className="button button--quiet"
        disabled={checking}
        onClick={async () => {
          setChecking(true);
          await refreshAI();
          setChecking(false);
        }}
      >
        {checking ? 'Looking…' : '🔄 Look again'}
      </button>

      <ModelLibrary />

      {!privateAI.online ? (
        <section className="setup-steps">
          <h4>Switch on your private AI (about 10 minutes, free)</h4>
          <ol>
            <li>
              Download the free <strong>Ollama</strong> app and install it like any other app:
              <CopyLine text="https://ollama.com/download" />
            </li>
            <li>Open Ollama. It runs quietly in the background.</li>
            <li>
              Come back here and press <strong>🔄 Look again</strong>. A library of AI tools appears here, and you add them with one
              click. No typing commands.
            </li>
          </ol>
          <p className="muted">
            Real pictures need one more free program, an image studio (for example Forge or AUTOMATIC1111). It’s more technical to
            set up, so until then pictures are {assistant.canDraw ? 'illustrations from the online assistant' : 'sketches'}.
          </p>
        </section>
      ) : !privateAI.chatModel ? (
        <section className="setup-steps">
          <h4>Almost there</h4>
          <p>Ollama is running. Add the “Everyday assistant” from the library below to switch on chat and writing.</p>
        </section>
      ) : null}

      {(privateAI.online || studio.online) && (
        <details className="setup">
          <summary>Technical details (for the curious)</summary>
          <ul className="muted">
            {privateAI.chatModel && <li>Assistant: {privateAI.chatModel}</li>}
            {privateAI.visionModel && <li>Picture reader: {privateAI.visionModel}</li>}
            {privateAI.online && <li>Found at: {privateAI.baseUrl}</li>}
            {studio.online && <li>Image studio found at: {studio.baseUrl}</li>}
          </ul>
        </details>
      )}
    </div>
  );
}

/** Phase 5 and 5A: which tools suit this computer, installing them, and tidying up with permission. */
function ModelLibrary() {
  const privateAI = useBoard((s) => s.privateAI);
  const settings = useBoard((s) => s.settings);
  const [computer, setComputer] = useState<ComputerInfo | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const [problem, setProblem] = useState('');

  useEffect(() => {
    getComputerInfo().then(setComputer);
  }, []);

  if (!privateAI.online) {
    return computer ? (
      <article className="service">
        <h4>💻 Your computer</h4>
        <p>{describeComputer(computer)}</p>
        <p className="muted">When your private assistant is running, you can add creative tools here.</p>
      </article>
    ) : null;
  }

  const installed = new Set(privateAI.installed.map((m) => m.id.replace(/:latest$/, '')));
  const lowOnSpace = computer?.freeDiskGB !== undefined && computer.freeDiskGB < 10;
  const suggestions = settings.storage === 'tidy' ? tidySuggestions(privateAI.installed) : [];

  const install = async (id: string) => {
    setProblem('');
    try {
      await installModel(privateAI, id, (fraction, words) =>
        setProgress((p) => ({ ...p, [id]: fraction === null ? words : `${words} ${Math.round(fraction * 100)}%` })),
      );
      await refreshAI();
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setProgress((p) => {
        const rest = { ...p };
        delete rest[id];
        return rest;
      });
    }
  };

  const remove = async (id: string, sizeGB: number) => {
    const name = catalogueEntry(id)?.name ?? id;
    if (!(await askToConfirm(`Remove “${name}” from this computer? This frees ${friendlySize(sizeGB)}. You can add it again later.`))) return;
    setProblem('');
    try {
      await removeModel(privateAI, id);
      await refreshAI();
    } catch (err) {
      setProblem((err as Error).message);
    }
  };

  return (
    <section className="library">
      <h4>💻 Your computer</h4>
      <p>{computer ? describeComputer(computer) : 'Checking your computer…'}</p>
      {computer?.freeDiskGB !== undefined && <p className="muted">Free space: {friendlySize(computer.freeDiskGB)}.</p>}

      <h4>📚 AI Model Library</h4>
      <p className="muted">Creative tools that run privately on this computer. Each downloads once, then works offline.</p>
      <ul className="models">
        {CATALOGUE.map((m) => {
          const fit = computer ? fitFor(m, computer) : 'unknown';
          const has = installed.has(m.id);
          return (
            <li key={m.id} className={`model model--${fit}`}>
              <div>
                <strong>{m.name}</strong>
                <small>{m.about}</small>
                <small className="model__fit">
                  {FIT_WORDS[fit]} · {friendlySize(m.sizeGB)}
                </small>
              </div>
              {has ? (
                <span className="chip">✓ Installed</span>
              ) : progress[m.id] ? (
                <span className="chip">{progress[m.id]}</span>
              ) : (
                <button className="button button--small" disabled={fit === 'too-big'} onClick={() => install(m.id)}>
                  Add
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {privateAI.installed.length > 0 && (
        <>
          <h4>🗂️ Installed on this computer</h4>
          <ul className="models">
            {privateAI.installed.map((m) => {
              const used = lastUsed(m.id);
              return (
                <li key={m.id} className="model">
                  <div>
                    <strong>{catalogueEntry(m.id)?.name ?? m.id}</strong>
                    <small>
                      Uses {friendlySize(m.sizeGB)}
                      {used ? ` · last used ${new Date(used).toLocaleDateString()}` : ''}
                    </small>
                  </div>
                  <button className="button button--small button--quiet" onClick={() => remove(m.id, m.sizeGB)}>
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <h4>🧹 Smart storage</h4>
      <div className="choices" role="radiogroup" aria-label="Smart storage">
        <label className={settings.storage === 'keep' ? 'choice is-on' : 'choice'}>
          <input type="radio" checked={settings.storage === 'keep'} onChange={() => useBoard.getState().setSettings({ storage: 'keep' })} />
          <span className="choice__label">Keep everything installed</span>
          <span className="choice__text">Nothing is ever suggested for removal.</span>
        </label>
        <label className={settings.storage === 'tidy' ? 'choice is-on' : 'choice'}>
          <input type="radio" checked={settings.storage === 'tidy'} onChange={() => useBoard.getState().setSettings({ storage: 'tidy' })} />
          <span className="choice__label">Suggest tidying up</span>
          <span className="choice__text">Points out tools you haven’t used for a month. Nothing is removed unless you say yes.</span>
        </label>
      </div>
      {settings.storage === 'tidy' &&
        (suggestions.length ? (
          <div className="gentle-tip">
            {lowOnSpace ? 'Your computer is getting low on space. ' : ''}These haven’t been used for a month:
            <ul>
              {suggestions.map((m) => (
                <li key={m.id}>
                  {catalogueEntry(m.id)?.name ?? m.id} ({friendlySize(m.sizeGB)}){' '}
                  <button className="chip" onClick={() => remove(m.id, m.sizeGB)}>
                    Remove…
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="muted">Everything installed has been used recently. Nothing to tidy.</p>
        ))}
      {problem && <p className="problem">{problem}</p>}
    </section>
  );
}

/** Shows an address with a Copy button (links can't always open from inside the app). */
function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="copy-line">
      <code>{text}</code>
      <button
        className="chip"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </span>
  );
}
