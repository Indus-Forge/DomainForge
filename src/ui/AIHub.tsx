import { useEffect, useState, type ReactNode } from 'react';
import { useBoard, type ChatRoute, type Connections, type PictureRoute } from '../store/board';
import { ASSISTANT_NAMES, available, pickFrom, spiceBase, spiceIsPrivate, type AISources, type AssistantKind } from '../ai/assistant';
import { chat, installModel } from '../ai/privateAI';
import { ocAnswer, type OCServer } from '../ai/openaiCompat';
import { HF_CHAT_MODELS, HF_PICTURE_MODELS, HF_ROUTER, HF_VISION_MODELS, hfPicture } from '../ai/huggingface';
import { choosePictureMaker, PICTURE_MAKER_NAMES, pictureMakersReady } from '../ai/create';
import { makePicture } from '../ai/imageEngine';
import { refreshAI, ModelLibrary } from './YourAI';
import { isDesktop } from '../platform';

/**
 * The AI Hub: one place to connect the AI that powers the board and to choose
 * which does what. Private AI (on this computer) and online services sit side
 * by side, always labelled, so people can see and decide where their words go.
 */
export function AIHub() {
  const open = useBoard((s) => s.hubOpen);
  const privateAI = useBoard((s) => s.privateAI);
  const onlineAI = useBoard((s) => s.onlineAI);
  const localAI = useBoard((s) => s.localAI);
  const spiceAI = useBoard((s) => s.spiceAI);
  const hf = useBoard((s) => s.hf);
  const studio = useBoard((s) => s.studio);
  const settings = useBoard((s) => s.settings);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && useBoard.getState().setHubOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const inPreview = Boolean((globalThis as { claude?: unknown }).claude) && !isDesktop;
  const c = settings.connections;
  const sources: AISources = { privateAI, onlineAI, localAI, spiceAI, hf, connections: c, educatorMode: settings.educatorMode };
  const assistant = pickFrom(sources);
  const makers = pictureMakersReady();
  const maker = choosePictureMaker();
  const set = (patch: Partial<Connections>) => useBoard.getState().setConnections(patch);
  const lookAgain = async () => {
    setChecking(true);
    await refreshAI();
    setChecking(false);
  };

  const chatOptions: { value: ChatRoute; label: string; ready: boolean; hidden?: boolean }[] = [
    { value: 'auto', label: 'Auto (private first)', ready: Boolean(assistant.kind) },
    { value: 'private', label: 'Ollama', ready: available('private', sources) },
    { value: 'spice', label: 'Spice.ai', ready: available('spice', sources) },
    { value: 'local', label: 'Local model server', ready: available('local', sources) },
    { value: 'huggingface', label: 'Hugging Face', ready: available('huggingface', sources) },
    { value: 'online', label: 'Online assistant', ready: available('online', sources), hidden: !onlineAI.available },
  ];
  const pictureOptions: { value: PictureRoute; label: string; ready: boolean; hidden?: boolean }[] = [
    { value: 'auto', label: 'Auto (private first)', ready: true },
    { value: 'studio', label: 'Image studio', ready: makers.studio },
    { value: 'huggingface', label: 'Hugging Face', ready: makers.huggingface },
    { value: 'online', label: 'Online illustration', ready: makers.online, hidden: !onlineAI.available },
    { value: 'sketch', label: 'Sketch only', ready: true },
  ];

  return (
    <div className="hub" role="dialog" aria-modal="true" aria-labelledby="hub-title">
      <header className="hub__head">
        <div>
          <h2 id="hub-title">⚡ AI Hub</h2>
          <p className="muted">
            Connect the AI that powers your board, and choose which does what. <span className="tag tag--private">Private</span>{' '}
            runs on this computer. <span className="tag tag--online">Online</span> sends your words to a service on the internet.
          </p>
        </div>
        <div className="hub__head-actions">
          <button className="button button--small" onClick={lookAgain} disabled={checking}>
            {checking ? 'Checking…' : '🔄 Check all'}
          </button>
          <button className="panel__close hub__close" onClick={() => useBoard.getState().setHubOpen(false)} aria-label="Close">
            ×
          </button>
        </div>
      </header>

      <section className="hub__routes">
        <Route
          title="💬 Chat & writing"
          now={assistant.kind ? nameWithModel(assistant.kind, sources) : 'Nothing connected yet'}
          value={c.chatWith}
          options={chatOptions}
          onChange={(v) => set({ chatWith: v as ChatRoute })}
        />
        <Route
          title="🖼️ Pictures"
          now={PICTURE_MAKER_NAMES[maker] + (maker === 'huggingface' ? ` · ${short(c.hfPictureModel)}` : '')}
          value={c.picturesWith}
          options={pictureOptions}
          onChange={(v) => set({ picturesWith: v as PictureRoute })}
        />
        <div className="route">
          <div className="route__title">👁️ Reading pictures & directing videos</div>
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

      {inPreview && (
        <p className="gentle-tip">
          👀 You’re in the online preview. It can only use the online assistant: preview pages aren’t allowed to reach Hugging Face
          or AI on your computer. Run Workshop on your computer (see the README) to connect Ollama, Hugging Face or a local model.
        </p>
      )}

      {settings.educatorMode && (
        <p className="gentle-tip">🎓 Educator mode is on, so online services are switched off. Everything stays on this computer.</p>
      )}

      <div className="hub__grid">
        <OllamaCard />

        <Provider
          icon="🌶️"
          title="Spice.ai"
          tag="private"
          ready={spiceAI.online}
          status={
            spiceAI.online
              ? `Running · ${spiceAI.models.length} model${spiceAI.models.length === 1 ? '' : 's'}${c.spiceModel && !spiceIsPrivate(c.spiceModel) ? ' · this model is online' : ''}`
              : 'Not running. See spice/README.md, then run “spice run” in the spice folder.'
          }
          about="One local runtime that serves Ollama, Hugging Face and local file models through a single address. Models named “hf-…” run online at Hugging Face; the rest run on this computer."
        >
          <Field label="Address">
            <input value={c.spiceUrl} placeholder="Automatic (127.0.0.1:8090)" onChange={(e) => set({ spiceUrl: e.target.value })} onBlur={lookAgain} />
          </Field>
          <Field label="Model">
            {spiceAI.models.length ? (
              <select value={c.spiceModel} onChange={(e) => set({ spiceModel: e.target.value, spiceVision: /vision|vl/i.test(e.target.value) })}>
                <option value="">Choose a model…</option>
                {spiceAI.models.map((m) => (
                  <option key={m} value={m}>
                    {m} {spiceIsPrivate(m) ? '· private' : '· online'}
                  </option>
                ))}
              </select>
            ) : (
              <input value={c.spiceModel} placeholder="e.g. local-ollama-chat" onChange={(e) => set({ spiceModel: e.target.value })} />
            )}
          </Field>
          <label className="check">
            <input type="checkbox" checked={c.spiceVision} onChange={(e) => set({ spiceVision: e.target.checked })} /> This model can look at pictures
          </label>
          <TestButton
            disabled={!spiceAI.online || !c.spiceModel}
            run={() => ocAnswer({ baseUrl: spiceBase(c), model: c.spiceModel }, [{ role: 'user', content: 'Say hello in five words.' }], 'Spice.ai')}
          />
        </Provider>

        <Provider
          icon="🧩"
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
          {!isDesktop && (
            <small className="muted">
              In the browser, your server must allow browser requests (CORS). LM Studio: Developer → Settings → Enable CORS. The desktop
              app doesn’t need this.
            </small>
          )}
          <label className="check">
            <input type="checkbox" checked={c.localVision} onChange={(e) => set({ localVision: e.target.checked })} /> This model can look at pictures
          </label>
          <TestButton
            disabled={!c.localUrl || !c.localModel}
            run={() => ocAnswer({ baseUrl: c.localUrl, model: c.localModel }, [{ role: 'user', content: 'Say hello in five words.' }], 'Your local model server')}
          />
        </Provider>

        <Provider
          icon="🤗"
          title="Hugging Face"
          tag="online"
          ready={hf.connected}
          status={settings.educatorMode ? 'Off in educator mode' : hf.connected ? `Connected as ${hf.name ?? 'you'}` : hf.error ?? 'Not connected'}
          about="Real pictures (FLUX, Stable Diffusion) and Qwen chat without installing anything. Uses your own free account."
        >
          <HFToken />
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
              picture
              run={() => hfPicture(c.hfToken, c.hfPictureModel, 'a friendly small robot waving, colourful illustration')}
            />
          </div>
        </Provider>

        <Provider
          icon="🎨"
          title="Image studio"
          tag="private"
          ready={studio.online}
          status={studio.online ? `Connected at ${studio.baseUrl}` : 'Not found'}
          about="A local picture maker with the Stable Diffusion web API (Forge or AUTOMATIC1111 started with --api). Private and offline."
        >
          <Field label="Address">
            <input value={c.studioUrl} placeholder="Automatic (127.0.0.1:7860)" onChange={(e) => set({ studioUrl: e.target.value })} onBlur={lookAgain} />
          </Field>
          <TestButton label="Test a picture" picture disabled={!studio.online} run={async () => (await makePicture(studio, 'a friendly small robot waving')).image} />
        </Provider>

        {onlineAI.available && (
          <Provider
            icon="🌐"
            title="Online assistant (Claude)"
            tag="online"
            ready={available('online', sources)}
            status={settings.educatorMode ? 'Off in educator mode' : 'Available in this preview'}
            about="Only in the claude.ai preview. Chats, writes, reads pictures and draws simple illustrations."
          />
        )}
      </div>
    </div>
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
      : kind === 'spice'
        ? s.connections.spiceModel
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

function Provider(props: { icon: string; title: string; tag: 'private' | 'online'; ready: boolean; status: string; about: string; children?: ReactNode }) {
  return (
    <article className={`provider${props.ready ? ' is-ready' : ''}`}>
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
function TestButton({ run, label = 'Test', disabled, picture }: { run(): Promise<string>; label?: string; disabled?: boolean; picture?: boolean }) {
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
        {state.busy ? 'Testing…' : `▶ ${label}`}
      </button>
      {state.ok === true &&
        (picture ? (
          <span className="test__result is-ok">
            ✓ {(state.ms! / 1000).toFixed(1)}s <img src={state.text} alt="Test picture" />
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

function HFToken() {
  const token = useBoard((s) => s.settings.connections.hfToken);
  const [draft, setDraft] = useState(token);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Field label="Access token">
        <span className="token">
          <input
            type={show ? 'text' : 'password'}
            value={draft}
            placeholder="hf_…"
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
        <button
          className="button button--small button--primary"
          disabled={busy || !draft.trim()}
          onClick={async () => {
            setBusy(true);
            useBoard.getState().setConnections({ hfToken: draft.trim() });
            await refreshAI();
            setBusy(false);
          }}
        >
          {busy ? 'Connecting…' : token ? 'Save & reconnect' : 'Connect'}
        </button>
        {token && (
          <button
            className="button button--small"
            onClick={async () => {
              setDraft('');
              useBoard.getState().setConnections({ hfToken: '' });
              await refreshAI();
            }}
          >
            Disconnect
          </button>
        )}
      </div>
      <small className="muted">
        Get a free token at huggingface.co → Settings → Access Tokens (allow “Make calls to Inference Providers”). It’s kept only
        in this app on this computer.
      </small>
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
      icon="🦙"
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
          <div className="chips">
            {privateAI.installed.map((m) => (
              <span key={m.id} className={`chip${m.id === privateAI.chatModel || m.id === privateAI.visionModel ? ' is-used' : ''}`} title={`${m.sizeGB.toFixed(1)} GB`}>
                {m.id}
                {m.id === privateAI.chatModel && ' · chat'}
                {m.id === privateAI.visionModel && ' · sees pictures'}
              </span>
            ))}
          </div>
          <Field label="Add any model by name">
            <span className="token">
              <input value={name} placeholder="e.g. qwen2.5vl:3b" onChange={(e) => setName(e.target.value)} />
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
          <TestButton
            disabled={!privateAI.chatModel}
            run={async () => {
              let out = '';
              for await (const piece of chat(privateAI, [{ role: 'user', content: 'Say hello in five words.' }])) out += piece;
              return out.trim();
            }}
          />
          <details className="setup">
            <summary>📚 Model Library: recommended for your computer</summary>
            <ModelLibrary />
          </details>
        </>
      )}
    </Provider>
  );
}
