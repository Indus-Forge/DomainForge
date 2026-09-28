import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AudioLines, Cloud, Cpu, Globe, Image as ImageIcon, Play, Search, Server } from 'lucide-react';
import { useBoard, type ChatRoute, type Connections, type PictureRoute } from '../store/board';
import { ASSISTANT_NAMES, available, pickFrom, type AISources, type AssistantKind } from '../ai/assistant';
import { chat, installModel, isCloudModel } from '../ai/privateAI';
import { ocAnswer, type OCServer } from '../ai/openaiCompat';
import { HF_CHAT_MODELS, HF_PICTURE_MODELS, HF_ROUTER, HF_VISION_MODELS, hfPicture } from '../ai/huggingface';
import { choosePictureMaker, PICTURE_MAKER_NAMES, pictureMakersReady } from '../ai/create';
import { makePicture } from '../ai/imageEngine';
import { DEFAULT_VOICE_URL, speakWithAI } from '../ai/voice';
import { searchWeb } from '../ai/search';
import { connectionReport, type AdminSection } from '../ai/connections';
import { readSettingsFile, settingsFile } from '../store/settingsFile';
import { refreshAI, ModelLibrary, CopyLine } from './YourAI';
import { isDesktop, saveFile } from '../platform';

/**
 * Admin: every connection the Workshop can use, in one place. At the top, what
 * is connected and what isn't; below, the entries to connect each one. Private
 * services (on this computer) and online ones sit side by side, always
 * labelled, so people can see and decide where their words go.
 */
export function Admin() {
  const open = useBoard((s) => s.hubOpen);
  const privateAI = useBoard((s) => s.privateAI);
  const onlineAI = useBoard((s) => s.onlineAI);
  const localAI = useBoard((s) => s.localAI);
  const hf = useBoard((s) => s.hf);
  const studio = useBoard((s) => s.studio);
  const voice = useBoard((s) => s.voice);
  const search = useBoard((s) => s.search);
  const settings = useBoard((s) => s.settings);
  const [checking, setChecking] = useState(false);
  const [flash, setFlash] = useState<AdminSection | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useBoard.getState().setHubOpen(false);
    window.addEventListener('keydown', onKey);
    refreshAI();
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const inPreview = Boolean((globalThis as { claude?: unknown }).claude) && !isDesktop;
  const c = settings.connections;
  const sources: AISources = { privateAI, onlineAI, localAI, hf, connections: c, educatorMode: settings.educatorMode };
  const assistant = pickFrom(sources);
  const makers = pictureMakersReady();
  const maker = choosePictureMaker();
  const report = connectionReport({ privateAI, onlineAI, localAI, hf, studio, voice, search, settings });
  const readyCount = report.filter((r) => r.ready).length;
  const set = (patch: Partial<Connections>) => useBoard.getState().setConnections(patch);
  const lookAgain = async () => {
    setChecking(true);
    await refreshAI();
    setChecking(false);
  };
  const jump = (section: AdminSection) => {
    document.getElementById(`admin-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFlash(section);
    setTimeout(() => setFlash(null), 1600);
  };

  const chatOptions: { value: ChatRoute; label: string; ready: boolean; hidden?: boolean }[] = [
    { value: 'auto', label: 'Auto (private first)', ready: Boolean(assistant.kind) },
    { value: 'private', label: 'Ollama', ready: available('private', sources) },
    { value: 'local', label: 'Local model server', ready: available('local', sources) },
    { value: 'huggingface', label: 'Hugging Face', ready: available('huggingface', sources) },
    { value: 'online', label: 'Online assistant', ready: available('online', sources), hidden: !onlineAI.available },
  ];
  const pictureOptions: { value: PictureRoute; label: string; ready: boolean; hidden?: boolean }[] = [
    { value: 'auto', label: 'Auto (private first)', ready: maker !== null },
    { value: 'studio', label: 'Image studio', ready: makers.studio },
    { value: 'huggingface', label: 'Hugging Face', ready: makers.huggingface },
  ];

  return (
    <div className="hub admin" role="dialog" aria-modal="true" aria-labelledby="admin-title" data-flash={flash ?? undefined}>
      <header className="hub__head">
        <div>
          <h2 id="admin-title">Admin</h2>
          <p className="muted">
            Every connection the Workshop can use, in one place. <span className="tag tag--private">Private</span> runs on this
            computer. <span className="tag tag--online">Online</span> sends your words to a service on the internet.
          </p>
        </div>
        <div className="hub__head-actions">
          <button className="button button--small" onClick={lookAgain} disabled={checking}>
            {checking ? 'Checking…' : 'Check all'}
          </button>
          <button className="panel__close hub__close" onClick={() => useBoard.getState().setHubOpen(false)} aria-label="Close">
            ×
          </button>
        </div>
      </header>

      <section className="admin__status" aria-label="What’s connected">
        <div className="admin__score">
          <div>
            <strong>
              {readyCount} of {report.length}
            </strong>{' '}
            connected
          </div>
          <div className="meter" aria-hidden>
            <span style={{ width: `${(readyCount / report.length) * 100}%` }} />
          </div>
        </div>
        <ul className="admin__rows">
          {report.map((r) => (
            <li key={r.id} className={`admin__row${r.ready ? ' is-ready' : ''}`} data-capability={r.id}>
              <div className="admin__what">
                <span className={`dot ${r.ready ? 'dot--on' : ''}`} aria-hidden />
                <div>
                  <strong>{r.name}</strong>
                  <small>{r.powers}</small>
                </div>
              </div>
              <div className="admin__now">{r.now}</div>
              <div className="admin__need">{r.ready ? '' : r.need}</div>
              <button className={`button button--small${r.ready ? '' : ' button--primary'}`} onClick={() => jump(r.section)}>
                {r.ready ? 'Settings' : 'Connect'}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {inPreview && (
        <p className="gentle-tip">
          You’re in the online preview. It can only use the online assistant: preview pages aren’t allowed to reach Hugging Face
          or AI on your computer. Run Workshop on your computer (see the README) to connect everything below.
        </p>
      )}

      {settings.educatorMode && (
        <p className="gentle-tip">Educator mode is on, so online services are switched off. Everything stays on this computer.</p>
      )}

      <h3 className="admin__heading">Which does what</h3>
      <section className="hub__routes">
        <Route
          title="Chat & writing"
          now={assistant.kind ? nameWithModel(assistant.kind, sources) : 'Nothing connected yet'}
          value={c.chatWith}
          options={chatOptions}
          onChange={(v) => set({ chatWith: v as ChatRoute })}
        />
        <Route
          title="Pictures"
          now={maker ? PICTURE_MAKER_NAMES[maker] + (maker === 'huggingface' ? ` · ${short(c.hfPictureModel)}` : '') : 'Nothing connected: add a Hugging Face token below'}
          value={c.picturesWith}
          options={pictureOptions}
          onChange={(v) => set({ picturesWith: v as PictureRoute })}
        />
        <div className="route">
          <div className="route__title">Reading pictures & directing videos</div>
          <div className="route__now">
            {assistant.kind
              ? assistant.canSeePictures
                ? `Yes, by ${nameWithModel(assistant.kind, sources, true)}`
                : `${ASSISTANT_NAMES[assistant.kind]} can’t see pictures. Add a vision model below.`
              : 'Needs an assistant that can see pictures'}
          </div>
          <small className="muted">Uses the same assistant as chat.</small>
        </div>
      </section>

      <h3 className="admin__heading">Connections</h3>
      <div className="hub__grid">
        <OllamaCard />

        <Provider
          id="local"
          icon={<Server size={20} />}
          title="Local model server"
          tag="private"
          ready={localAI.online}
          status={localAI.online ? `Connected · ${localAI.models.length} model${localAI.models.length === 1 ? '' : 's'}` : c.localUrl ? 'Not answering' : 'Not set up'}
          about="Use any local app with an OpenAI-compatible address: LM Studio, llama.cpp server, Jan, vLLM, or Ollama’s /v1."
        >
          <Field label="Address">
            <input value={c.localUrl} placeholder="http://127.0.0.1:1234/v1" onChange={(e) => set({ localUrl: e.target.value })} onBlur={lookAgain} />
          </Field>
          <Field label="Model">
            {localAI.models.length ? (
              <select value={c.localModel} onChange={(e) => set({ localModel: e.target.value })}>
                <option value="">Choose a model…</option>
                {localAI.models.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            ) : (
              <input value={c.localModel} placeholder="the model’s name" onChange={(e) => set({ localModel: e.target.value })} />
            )}
          </Field>
          <label className="check">
            <input type="checkbox" checked={c.localVision} onChange={(e) => set({ localVision: e.target.checked })} /> This model can look at pictures
          </label>
          <TestButton
            disabled={!c.localUrl || !c.localModel}
            run={() => ocAnswer({ baseUrl: c.localUrl, model: c.localModel }, [{ role: 'user', content: 'Say hello in five words.' }], 'Your local model server')}
          />
        </Provider>

        <Provider
          id="huggingface"
          icon={<Cloud size={20} />}
          title="Hugging Face"
          tag="online"
          ready={hf.connected}
          status={settings.educatorMode ? 'Off in educator mode' : hf.connected ? `Connected as ${hf.name ?? 'you'}` : hf.error ?? 'Not connected'}
          about="Real pictures (FLUX, Stable Diffusion) and Qwen chat without installing anything. Uses your own free account."
        >
          <KeyField
            label="Access token"
            value={c.hfToken}
            placeholder="hf_…"
            onSave={async (hfToken) => {
              set({ hfToken });
              await refreshAI();
            }}
            help="Get a free token at huggingface.co → Settings → Access Tokens (allow “Make calls to Inference Providers”). It’s kept only in this app on this computer."
          />
          <Field label="Pictures with">
            <ModelSelect value={c.hfPictureModel} options={HF_PICTURE_MODELS} onChange={(v) => set({ hfPictureModel: v })} />
          </Field>
          <Field label="Chat with">
            <ModelSelect value={c.hfChatModel} options={HF_CHAT_MODELS} onChange={(v) => set({ hfChatModel: v })} />
          </Field>
          <Field label="Read pictures with">
            <ModelSelect value={c.hfVisionModel} options={HF_VISION_MODELS} onChange={(v) => set({ hfVisionModel: v })} />
          </Field>
          <div className="provider__tests">
            <TestButton
              label="Test chat"
              disabled={!hf.connected}
              run={() =>
                ocAnswer(
                  { baseUrl: HF_ROUTER, apiKey: c.hfToken, model: c.hfChatModel } as OCServer,
                  [{ role: 'user', content: 'Say hello in five words.' }],
                  'Hugging Face',
                )
              }
            />
            <TestButton
              label="Test a picture"
              disabled={!hf.connected}
              kind="picture"
              run={() => hfPicture(c.hfToken, c.hfPictureModel, 'a friendly small robot waving, colourful illustration')}
            />
          </div>
        </Provider>

        <Provider
          id="studio"
          icon={<ImageIcon size={20} />}
          title="Image studio"
          tag="private"
          ready={studio.online}
          status={studio.online ? `Connected at ${studio.baseUrl}` : 'Not found'}
          about="A local picture maker with the Stable Diffusion web API (Forge or AUTOMATIC1111 started with --api). Private and offline. Also powers AI enlarging. Needs a graphics card."
        >
          <Field label="Address">
            <input value={c.studioUrl} placeholder="Automatic (127.0.0.1:7860)" onChange={(e) => set({ studioUrl: e.target.value })} onBlur={lookAgain} />
          </Field>
          <TestButton label="Test a picture" kind="picture" disabled={!studio.online} run={async () => (await makePicture(studio, 'a friendly small robot waving')).image} />
        </Provider>

        <Provider
          id="voice"
          icon={<AudioLines size={20} />}
          title="AI voice"
          tag="private"
          ready={voice.online}
          status={voice.online ? `Connected at ${voice.baseUrl}${voice.voices.length ? ` · ${voice.voices.length} voices` : ''}` : c.voiceUrl ? 'Not answering' : 'Not found'}
          about="A speech server on this computer with the OpenAI-style speech API. Kokoro-FastAPI is free and runs without a graphics card. Powers the Voice tool."
        >
          <Field label="Address">
            <input value={c.voiceUrl} placeholder={`Automatic (${DEFAULT_VOICE_URL.replace('http://', '')})`} onChange={(e) => set({ voiceUrl: e.target.value })} onBlur={lookAgain} />
          </Field>
          <Field label="Voice">
            {voice.voices.length ? (
              <select value={c.voiceName} onChange={(e) => set({ voiceName: e.target.value })}>
                {!voice.voices.includes(c.voiceName) && <option value={c.voiceName}>{c.voiceName}</option>}
                {voice.voices.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            ) : (
              <input value={c.voiceName} placeholder="af_heart" onChange={(e) => set({ voiceName: e.target.value })} />
            )}
          </Field>
          <Field label="Model">
            <input value={c.voiceModel} placeholder="kokoro" onChange={(e) => set({ voiceModel: e.target.value })} />
          </Field>
          <TestButton
            label="Test voice"
            kind="audio"
            disabled={!voice.online}
            run={async () => URL.createObjectURL(await speakWithAI(voice, c.voiceModel, c.voiceName, 'Hello! This is your Workshop voice.'))}
          />
          <details className="setup">
            <summary>How to start Kokoro (about 5 minutes)</summary>
            <ol>
              <li>
                Install Docker Desktop, then run:
                <CopyLine text="docker run -d -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest" />
              </li>
              <li>Wait a minute for it to start, then press Check all.</li>
            </ol>
          </details>
        </Provider>

        <Provider
          id="search"
          icon={<Search size={20} />}
          title="SearXNG web search"
          tag="private"
          ready={search.searxng}
          status={search.searxng ? 'Connected' : search.searxngProblem ?? (c.searxngUrl ? 'Not answering' : 'Not set up')}
          about="Your own search server. It asks public search engines for you, with no account and no tracking, so the Research tool can cite real sources."
        >
          <Field label="Address">
            <input value={c.searxngUrl} placeholder="http://127.0.0.1:8080" onChange={(e) => set({ searxngUrl: e.target.value })} onBlur={lookAgain} />
          </Field>
          <TestButton
            label="Test search"
            disabled={!search.searxng}
            run={async () => {
              const results = await searchWeb('searxng', c, 'honey bees');
              return `${results.length} results. First: ${results[0]?.title ?? 'none'}`;
            }}
          />
          <details className="setup">
            <summary>How to start SearXNG</summary>
            <ol>
              <li>
                With Docker Desktop installed, run:
                <CopyLine text="docker run -d -p 8080:8080 searxng/searxng" />
              </li>
              <li>
                In its <code>settings.yml</code>, add <code>json</code> under <code>search: formats:</code> so apps can read results, then
                restart it.
              </li>
              <li>Enter http://127.0.0.1:8080 above.</li>
            </ol>
          </details>
        </Provider>

        <Provider
          id="tavily"
          icon={<Globe size={20} />}
          title="Tavily web search"
          tag="online"
          ready={Boolean(c.tavilyKey) && !settings.educatorMode}
          status={settings.educatorMode ? 'Off in educator mode' : c.tavilyKey ? 'Key saved · press Test search to check it' : 'Not set up'}
          about="An online search service made for AI. No install: a free account includes 1,000 searches a month. Used for research when SearXNG isn’t running."
        >
          <KeyField
            label="API key"
            value={c.tavilyKey}
            placeholder="tvly-…"
            onSave={(tavilyKey) => set({ tavilyKey })}
            help="Get a free key at tavily.com. It’s kept only in this app on this computer."
          />
          <TestButton
            label="Test search"
            disabled={!c.tavilyKey || settings.educatorMode}
            run={async () => {
              const results = await searchWeb('tavily', c, 'honey bees');
              return `${results.length} results. First: ${results[0]?.title ?? 'none'}`;
            }}
          />
        </Provider>

        {onlineAI.available && (
          <Provider
            id="online"
            icon={<Globe size={20} />}
            title="Online assistant (Claude)"
            tag="online"
            ready={available('online', sources)}
            status={settings.educatorMode ? 'Off in educator mode' : 'Available in this preview'}
            about="Only in the claude.ai preview. Chats, writes and reads pictures. It cannot make pictures: connect Hugging Face for that."
          />
        )}
      </div>

      <h3 className="admin__heading">Privacy & settings</h3>
      <div className="hub__grid">
        <PrivacyCard />
        <section className="provider">
          <h4 className="admin__subheading">Not built yet</h4>
          <p className="provider__about">These can’t be connected yet, because the Workshop doesn’t have them:</p>
          <ul className="admin__notbuilt">
            <li>
              <strong>AI video generation.</strong> The Video Maker edits your pictures (an AI can plan the shots); it doesn’t make
              new footage.
            </li>
            <li>
              <strong>Classroom accounts and sharing.</strong> Boards stay on each computer; share one with Boards → Export.
            </li>
            <li>
              <strong>Sync between computers.</strong> Move boards with Boards → Export, and these settings with Export settings.
            </li>
            <li>
              <strong>A safety filter for educator mode</strong>, and automatic updates for the desktop app.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

/** Educator mode, and moving these settings to another computer. */
function PrivacyCard() {
  const settings = useBoard((s) => s.settings);
  const [includeKeys, setIncludeKeys] = useState(false);
  const [message, setMessage] = useState('');
  const file = useRef<HTMLInputElement>(null);
  return (
    <section className="provider">
      <label className="toggle">
        <input type="checkbox" checked={settings.educatorMode} onChange={(e) => useBoard.getState().setSettings({ educatorMode: e.target.checked })} />
        <span>
          <strong>Educator mode: keep everything on this computer</strong>
          <small>Switches off every online service above, including Ollama cloud models. Ideal for classrooms.</small>
        </span>
      </label>
      <h4 className="admin__subheading">Move these settings to another computer</h4>
      <label className="check">
        <input type="checkbox" checked={includeKeys} onChange={(e) => setIncludeKeys(e.target.checked)} /> Include access keys (keep the file private)
      </label>
      <div className="provider__tests">
        <button
          className="button button--small"
          onClick={async () => {
            const saved = await saveFile('workshop-settings.json', settingsFile(useBoard.getState().settings, includeKeys));
            setMessage(saved ? `Settings saved${includeKeys ? ', with access keys' : ', without access keys'}.` : '');
          }}
        >
          Export settings
        </button>
        <button className="button button--small" onClick={() => file.current?.click()}>
          Import settings
        </button>
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const chosen = e.target.files?.[0];
            e.target.value = '';
            if (!chosen) return;
            try {
              const { connections, educatorMode } = readSettingsFile(await chosen.text());
              const { setConnections, setSettings } = useBoard.getState();
              setConnections(connections);
              if (educatorMode !== undefined) setSettings({ educatorMode });
              setMessage(`Imported ${Object.keys(connections).length} settings. Checking connections…`);
              await refreshAI();
              setMessage(`Imported ${Object.keys(connections).length} settings.`);
            } catch (err) {
              setMessage((err as Error).message);
            }
          }}
        />
      </div>
      {message && <small className="muted">{message}</small>}
    </section>
  );
}

function short(id: string) {
  return id.split('/').pop() ?? id;
}

function nameWithModel(kind: AssistantKind, s: AISources, vision = false): string {
  const model =
    kind === 'private'
      ? vision
        ? s.privateAI.visionModel
        : s.privateAI.chatModel
      : kind === 'local'
        ? s.connections.localModel
        : kind === 'huggingface'
          ? short(vision ? s.connections.hfVisionModel : s.connections.hfChatModel)
          : undefined;
  return model ? `${ASSISTANT_NAMES[kind]} · ${model}` : ASSISTANT_NAMES[kind];
}

function Route(props: {
  title: string;
  now: string;
  value: string;
  options: { value: string; label: string; ready: boolean; hidden?: boolean }[];
  onChange(value: string): void;
}) {
  return (
    <div className="route">
      <div className="route__title">{props.title}</div>
      <div className="route__now">Now: {props.now}</div>
      <div className="route__options" role="radiogroup" aria-label={props.title}>
        {props.options
          .filter((o) => !o.hidden)
          .map((o) => (
            <button
              key={o.value}
              role="radio"
              aria-checked={props.value === o.value}
              className={`route__option${props.value === o.value ? ' is-on' : ''}`}
              onClick={() => props.onChange(o.value)}
              title={o.ready ? 'Ready' : 'Not connected yet'}
            >
              <span className={`dot ${o.ready ? 'dot--on' : ''}`} aria-hidden />
              {o.label}
            </button>
          ))}
      </div>
    </div>
  );
}

function Provider(props: {
  id: string;
  icon: ReactNode;
  title: string;
  tag: 'private' | 'online';
  ready: boolean;
  status: string;
  about: string;
  children?: ReactNode;
}) {
  return (
    <article id={`admin-${props.id}`} className={`provider${props.ready ? ' is-ready' : ''}`}>
      <header className="provider__head">
        <span className="provider__icon" aria-hidden>
          {props.icon}
        </span>
        <div>
          <h3>{props.title}</h3>
          <span className={`tag tag--${props.tag}`}>{props.tag === 'private' ? 'Private · on this computer' : 'Online'}</span>
        </div>
      </header>
      <div className="provider__status">
        <span className={`dot ${props.ready ? 'dot--on' : ''}`} aria-hidden /> {props.status}
      </div>
      <p className="provider__about">{props.about}</p>
      {props.children}
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ModelSelect({ value, options, onChange }: { value: string; options: { id: string; name: string; about: string }[]; onChange(v: string): void }) {
  const known = options.some((o) => o.id === value);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {!known && <option value={value}>{value}</option>}
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.name} · {o.about}
        </option>
      ))}
    </select>
  );
}

/** Runs a real, tiny request and shows how long it took and what came back. */
function TestButton({ run, label = 'Test', disabled, kind = 'text' }: { run(): Promise<string>; label?: string; disabled?: boolean; kind?: 'text' | 'picture' | 'audio' }) {
  const [state, setState] = useState<{ busy?: boolean; ok?: boolean; text?: string; ms?: number }>({});
  return (
    <div className="test">
      <button
        className="button button--small"
        disabled={disabled || state.busy}
        onClick={async () => {
          setState({ busy: true });
          const start = performance.now();
          try {
            const text = await run();
            setState({ ok: true, text, ms: Math.round(performance.now() - start) });
          } catch (err) {
            setState({ ok: false, text: (err as Error).message });
          }
        }}
      >
        {state.busy ? 'Testing…' : <><Play size={12} /> {label}</>}
      </button>
      {state.ok === true &&
        (kind === 'picture' ? (
          <span className="test__result is-ok">
            ✓ {(state.ms! / 1000).toFixed(1)}s <img src={state.text} alt="Test picture" />
          </span>
        ) : kind === 'audio' ? (
          <span className="test__result is-ok">
            ✓ {(state.ms! / 1000).toFixed(1)}s <audio controls autoPlay src={state.text} />
          </span>
        ) : (
          <span className="test__result is-ok">
            ✓ {state.ms} ms: “{state.text?.slice(0, 80)}”
          </span>
        ))}
      {state.ok === false && <span className="test__result is-bad">✗ {state.text}</span>}
    </div>
  );
}

/** A secret key: hidden while typed, saved only when the person presses Save. */
function KeyField(props: { label: string; value: string; placeholder: string; help: string; onSave(value: string): void | Promise<void> }) {
  const [draft, setDraft] = useState(props.value);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(props.value), [props.value]);
  const save = async (value: string) => {
    setBusy(true);
    await props.onSave(value);
    setBusy(false);
  };
  return (
    <>
      <Field label={props.label}>
        <span className="token">
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            placeholder={props.placeholder}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button className="chip" onClick={() => setShow(!show)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </span>
      </Field>
      <div className="provider__tests">
        <button className="button button--small button--primary" disabled={busy || !draft.trim() || draft.trim() === props.value} onClick={() => save(draft.trim())}>
          {busy ? 'Connecting…' : props.value ? 'Save & reconnect' : 'Connect'}
        </button>
        {props.value && (
          <button
            className="button button--small"
            onClick={() => {
              setDraft('');
              save('');
            }}
          >
            Disconnect
          </button>
        )}
      </div>
      <small className="muted">{props.help}</small>
    </>
  );
}

function OllamaCard() {
  const privateAI = useBoard((s) => s.privateAI);
  const c = useBoard((s) => s.settings.connections);
  const [name, setName] = useState('');
  const [progress, setProgress] = useState('');
  const set = (patch: Partial<Connections>) => useBoard.getState().setConnections(patch);
  return (
    <Provider
      id="ollama"
      icon={<Cpu size={20} />}
      title="Ollama"
      tag="private"
      ready={privateAI.online}
      status={
        privateAI.online
          ? `Connected · ${privateAI.installed.length} model${privateAI.installed.length === 1 ? '' : 's'}${privateAI.chatModel ? '' : ' (add a chat model)'}`
          : 'Not running. Install it from ollama.com and open it.'
      }
      about="Runs AI models on this computer. Free, private, and works offline once a model is downloaded."
    >
      <Field label="Address">
        <input value={c.ollamaUrl} placeholder="Automatic (127.0.0.1:11434)" onChange={(e) => set({ ollamaUrl: e.target.value })} onBlur={() => refreshAI()} />
      </Field>
      {privateAI.online && (
        <>
          <Field label="Chat & writing with">
            <select
              value={c.ollamaChatModel}
              onChange={async (e) => {
                set({ ollamaChatModel: e.target.value });
                await refreshAI();
              }}
            >
              <option value="">Automatic{privateAI.chatModel ? ` (${privateAI.chatModel})` : ''}</option>
              {privateAI.models.map((m) => (
                <option key={m} value={m}>
                  {m} {isCloudModel(m) ? '· cloud, online' : '· on this computer'}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reading pictures with">
            <select
              value={c.ollamaVisionModel}
              onChange={async (e) => {
                set({ ollamaVisionModel: e.target.value });
                await refreshAI();
              }}
            >
              <option value="">Automatic{privateAI.visionModel ? ` (${privateAI.visionModel})` : ' (none installed)'}</option>
              {privateAI.models.map((m) => (
                <option key={m} value={m}>
                  {m} {isCloudModel(m) ? '· cloud, online' : '· on this computer'}
                </option>
              ))}
            </select>
          </Field>
          {(isCloudModel(privateAI.chatModel) || isCloudModel(privateAI.visionModel)) && (
            <p className="gentle-tip">
              A cloud model is in use. It runs on Ollama’s servers, so your words (and pictures, for reading) are sent online.
              Educator mode switches cloud models off.
            </p>
          )}
          <Field label="Add any model by name">
            <span className="token">
              <input value={name} placeholder="e.g. qwen2.5vl:3b or gemma3:27b-cloud" onChange={(e) => setName(e.target.value)} />
              <button
                className="button button--small"
                disabled={!name.trim() || Boolean(progress)}
                onClick={async () => {
                  try {
                    await installModel(privateAI, name.trim(), (f, words) => setProgress(f === null ? words : `${words} ${Math.round(f * 100)}%`));
                    setName('');
                    await refreshAI();
                  } catch (err) {
                    setProgress((err as Error).message);
                    return;
                  }
                  setProgress('');
                }}
              >
                Add
              </button>
            </span>
          </Field>
          {progress && <small className="muted">{progress}</small>}
          <small className="muted">
            Cloud models (names ending in “-cloud”, listed at ollama.com/search?c=cloud) run on Ollama’s servers instead of your
            computer: no big download, and no graphics card needed. Sign in once first by running <code>ollama signin</code>.
          </small>
          <TestButton
            disabled={!privateAI.chatModel}
            run={async () => {
              let out = '';
              for await (const piece of chat(privateAI, [{ role: 'user', content: 'Say hello in five words.' }])) out += piece;
              return out.trim();
            }}
          />
          <details className="setup">
            <summary>Model Library: recommended for your computer</summary>
            <ModelLibrary />
          </details>
        </>
      )}
    </Provider>
  );
}
