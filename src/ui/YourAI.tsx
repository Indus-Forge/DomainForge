import { useEffect, useState } from 'react';
import { useBoard } from '../store/board';
import { connectionReport } from '../ai/connections';
import { checkPrivateAI, installModel, removeModel } from '../ai/privateAI';
import { checkImageStudio } from '../ai/imageEngine';
import { checkOnlineAI } from '../ai/onlineAI';
import { ocModels } from '../ai/openaiCompat';
import { checkHuggingFace } from '../ai/huggingface';
import { checkVoice } from '../ai/voice';
import { checkSearch } from '../ai/search';
import { ASSISTANT_NAMES, useAssistant } from '../ai/assistant';
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
  const { setPrivateAI, setStudio, setOnlineAI, setLocalAI, setHF, setVoice, setSearch, settings } = useBoard.getState();
  const c = settings.connections;
  const [ai, studio, online, local, hf, voice, search] = await Promise.all([
    checkPrivateAI(c.ollamaChatModel, c.ollamaUrl, c.ollamaVisionModel),
    checkImageStudio(c.studioUrl),
    checkOnlineAI(),
    c.localUrl.trim() ? ocModels(c.localUrl).then((models) => ({ online: true, models })).catch(() => ({ online: false, models: [] })) : { online: false, models: [] },
    checkHuggingFace(c.hfToken),
    checkVoice(c.voiceUrl),
    checkSearch(c.searxngUrl),
  ]);
  setPrivateAI(ai);
  setStudio(studio);
  setOnlineAI(online);
  setLocalAI(local);
  setHF(hf);
  setVoice(voice);
  setSearch(search);
}

/**
 * "Your AI": what the AI can do right now, in plain words, and where your
 * words go. Setting things up lives in Admin; children in classroom mode only
 * ever see this.
 */
export function YourAI() {
  const privateAI = useBoard((s) => s.privateAI);
  const onlineAI = useBoard((s) => s.onlineAI);
  const localAI = useBoard((s) => s.localAI);
  const hf = useBoard((s) => s.hf);
  const studio = useBoard((s) => s.studio);
  const voice = useBoard((s) => s.voice);
  const search = useBoard((s) => s.search);
  const settings = useBoard((s) => s.settings);
  const assistant = useAssistant();
  const report = connectionReport({ privateAI, onlineAI, localAI, hf, studio, voice, search, settings });
  const classroom = settings.classroom;
  const online = report.filter((r) => r.online);

  return (
    <div className="your-ai">
      <p className={`promise ${online.length ? 'promise--online' : ''}`}>
        {online.length ? (
          <>
            <strong>Some of your AI works on the internet.</strong>
            <br />
            Your boards stay on this computer. The words you send for {online.map((r) => r.name.toLowerCase()).join(', ')} travel
            online to be answered. Everything else stays here.
          </>
        ) : (
          <>
            <strong>Your AI. Your computer. Your ideas.</strong>
            <br />
            Everything you connect runs on this computer. Your boards and pictures are never uploaded.
          </>
        )}
      </p>

      <h4 className="your-ai__heading">What the AI can do right now</h4>
      <ul className="can-do">
        {report.map((r) => (
          <li key={r.id} className={r.ready ? 'is-ready' : ''}>
            <span className={`dot ${r.ready ? 'dot--on' : ''}`} aria-hidden />
            <div>
              <strong>{r.name}</strong>
              <small>
                {classroom
                  ? r.ready
                    ? r.online
                      ? 'Yes, using a service on the internet'
                      : 'Yes, on this computer'
                    : 'Not switched on'
                  : r.ready
                    ? r.now.replace(/^Using /, 'By ')
                    : r.now.replace(/^Not connected: /, 'Not yet: ')}
              </small>
            </div>
          </li>
        ))}
      </ul>

      {assistant.kind && <p className="muted">Your Producer is {ASSISTANT_NAMES[assistant.kind]}.</p>}

      {classroom ? (
        <p className="muted">Your teacher chooses which AI the Workshop uses.</p>
      ) : (
        <button className="button button--primary hub-open" onClick={() => useBoard.getState().setHubOpen(true)}>
          Open Admin to connect the rest
        </button>
      )}
    </div>
  );
}

export function ModelLibrary() {
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
        <h4>Your computer</h4>
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
      <h4>Your computer</h4>
      <p>{computer ? describeComputer(computer) : 'Checking your computer…'}</p>
      {computer?.freeDiskGB !== undefined && <p className="muted">Free space: {friendlySize(computer.freeDiskGB)}.</p>}

      <h4>AI Model Library</h4>
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
          <h4>Installed on this computer</h4>
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

      <h4>Smart storage</h4>
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
export function CopyLine({ text }: { text: string }) {
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
