import { useState } from 'react';
import { useBoard } from '../store/board';
import { checkPrivateAI } from '../ai/privateAI';
import { checkImageStudio } from '../ai/imageEngine';

export async function refreshAI() {
  const { setPrivateAI, setStudio } = useBoard.getState();
  const [ai, studio] = await Promise.all([checkPrivateAI(), checkImageStudio()]);
  setPrivateAI(ai);
  setStudio(studio);
}

/** What AI is available on this computer, described in everyday words. */
export function YourAI() {
  const privateAI = useBoard((s) => s.privateAI);
  const studio = useBoard((s) => s.studio);
  const [checking, setChecking] = useState(false);

  return (
    <div className="your-ai">
      <p className="promise">
        <strong>Your AI. Your computer. Your ideas.</strong>
        <br />
        Everything here runs on this computer. Your boards and pictures are never uploaded.
      </p>

      <article className={`service ${privateAI.online ? 'is-on' : ''}`}>
        <h4>{privateAI.online ? '🟢' : '⚪'} Personal AI Assistant</h4>
        <p>
          {privateAI.online
            ? 'Ready. Your Producer can chat, plan and smooth your wording.'
            : 'Not running yet. You can still build boards, get plans from the Producer, and make sketches.'}
        </p>
        {privateAI.online && (
          <p className="muted">{privateAI.visionModel ? 'It can also look at your pictures and describe them.' : 'It can’t look at pictures yet.'}</p>
        )}
      </article>

      <article className={`service ${studio.online ? 'is-on' : ''}`}>
        <h4>{studio.online ? '🟢' : '⚪'} Image studio</h4>
        <p>{studio.online ? 'Ready. Your pictures are made on this computer.' : 'Not set up yet. Pictures are shown as sketch previews for now.'}</p>
      </article>

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

      <details className="setup">
        <summary>How do I switch these on?</summary>
        <ol>
          <li>
            <strong>Personal AI Assistant:</strong> install the free <em>Ollama</em> app from ollama.com, open it, and add a
            small assistant such as <code>llama3.2</code>. For picture descriptions, also add <code>llava</code>.
          </li>
          <li>
            <strong>Image studio:</strong> any studio that offers the Stable Diffusion web API works (for example AUTOMATIC1111 or
            Forge, started with <code>--api</code>).
          </li>
          <li>Come back here and press “Look again”.</li>
        </ol>
        <p className="muted">Both are free and run entirely on your computer. You never need them to start learning.</p>
      </details>

      {(privateAI.online || studio.online) && (
        <details className="setup">
          <summary>Technical details (for the curious)</summary>
          <ul className="muted">
            {privateAI.online && <li>Assistant: {privateAI.chatModel}</li>}
            {privateAI.visionModel && <li>Picture reader: {privateAI.visionModel}</li>}
            {privateAI.online && <li>Found at: {privateAI.baseUrl}</li>}
            {studio.online && <li>Image studio found at: {studio.baseUrl}</li>}
          </ul>
        </details>
      )}
    </div>
  );
}
