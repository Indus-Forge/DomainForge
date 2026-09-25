import { useMemo, useState } from 'react';
import type { Ingredient, IngredientRole, Recipe } from '../model/types';
import { CARD_INFO } from '../model/cards';
import { useBoard } from '../store/board';
import { buildRecipe, compareRecipes, creationsFrom } from '../ai/recipe';
import { polish as polishWords, useAssistant } from '../ai/assistant';
import { createPicture } from '../ai/create';

const ROLE_NAMES: Record<IngredientRole, string> = {
  subject: 'Main idea',
  character: 'Character',
  detail: 'Detail',
  reference: 'Reference picture',
  style: 'Style',
};

type Choice = 'board' | 'polished' | 'own';

export function RecipePanel() {
  const view = useBoard((s) => s.recipeView);
  const project = useBoard((s) => s.project);
  const close = () => useBoard.getState().openRecipe(null);
  if (!view) return null;

  const card = project.cards.find((c) => c.id === view.cardId);
  if (!card) return null;

  return (
    <div className="overlay" onPointerDown={(e) => e.target === e.currentTarget && close()}>
      <section className="panel" role="dialog" aria-modal="true" aria-labelledby="recipe-title">
        <button className="panel__close" onClick={close} aria-label="Close">
          ×
        </button>
        {view.mode === 'made' && card.recipe ? (
          <MadeRecipe recipe={card.recipe} cardId={card.id} />
        ) : (
          <PreviewRecipe recipe={buildRecipe(project, card.id)} onDone={close} />
        )}
      </section>
    </div>
  );
}

function Ingredients({ items }: { items: Ingredient[] }) {
  return (
    <ol className="ingredients">
      {items.map((i) => (
        <li key={i.cardId} className={`ingredient ingredient--${i.kind}`}>
          <span className="ingredient__icon" aria-hidden>
            {CARD_INFO[i.kind].icon}
          </span>
          <div>
            <div className="ingredient__role">{ROLE_NAMES[i.role]}</div>
            {i.text && <div className="ingredient__text">“{i.text}”</div>}
            <div className="ingredient__why">{i.why}</div>
          </div>
          {i.image && <img className="ingredient__thumb" src={i.image} alt="" />}
        </li>
      ))}
    </ol>
  );
}

function PreviewRecipe({ recipe, onDone }: { recipe: Recipe; onDone(): void }) {
  const assistant = useAssistant();
  const studio = useBoard((s) => s.studio);
  const learn = useBoard.getState().learn;

  const [choice, setChoice] = useState<Choice>('board');
  const [polished, setPolished] = useState('');
  const [own, setOwn] = useState(recipe.description);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');

  const connected = recipe.ingredients.length > 1;
  const sent = choice === 'polished' ? polished : choice === 'own' ? own : recipe.description;
  const tip = useMemo(() => {
    const roles = new Set(recipe.ingredients.map((i) => i.role));
    if (!connected) return 'Tip: connect a picture, a character or a style to this card. Each connection adds to what the AI reads.';
    if (!roles.has('style')) return 'Tip: connecting a Style card changes how the whole picture looks, without rewriting your idea.';
    if (!roles.has('reference')) return 'Tip: a reference picture shows the AI what you mean faster than words can.';
    return '';
  }, [recipe, connected]);

  const polish = async () => {
    setBusy(true);
    setProblem('');
    try {
      setPolished(await polishWords(recipe.description));
      setChoice('polished');
      learn('polished');
    } catch (err) {
      setProblem((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 id="recipe-title">Here’s how your board becomes instructions</h2>
      <p className="panel__lead">AI can’t see your board. It reads a description made from the cards you connected. Nothing else is added.</p>

      <h3>
        <span className="step">1</span> What I found on your board
      </h3>
      <Ingredients items={recipe.ingredients} />
      {tip && <p className="gentle-tip">💡 {tip}</p>}

      <h3>
        <span className="step">2</span> What the AI will read
      </h3>
      <div className="choices" role="radiogroup">
        <label className={choice === 'board' ? 'choice is-on' : 'choice'}>
          <input type="radio" checked={choice === 'board'} onChange={() => setChoice('board')} />
          <span className="choice__label">Your board’s words</span>
          <span className="choice__text">{recipe.description || 'Your card is empty. Write something on it first.'}</span>
        </label>
        {polished && (
          <label className={choice === 'polished' ? 'choice is-on' : 'choice'}>
            <input type="radio" checked={choice === 'polished'} onChange={() => setChoice('polished')} />
            <span className="choice__label">
              Smoothed by your {assistant.kind === 'online' ? 'online' : 'private'} assistant
            </span>
            <span className="choice__text">{polished}</span>
          </label>
        )}
        <label className={choice === 'own' ? 'choice is-on' : 'choice'}>
          <input type="radio" checked={choice === 'own'} onChange={() => setChoice('own')} />
          <span className="choice__label">Your own words</span>
          {choice === 'own' ? (
            <textarea className="choice__edit" value={own} onChange={(e) => setOwn(e.target.value)} rows={3} autoFocus />
          ) : (
            <span className="choice__text muted">Change the wording yourself.</span>
          )}
        </label>
      </div>
      {assistant.kind && !polished && (
        <button className="button button--quiet" onClick={polish} disabled={busy || !recipe.description}>
          {busy ? 'Your assistant is writing…' : '✍️ Ask my assistant to smooth the wording'}
        </button>
      )}

      <h3>
        <span className="step">3</span> Who makes it
      </h3>
      {studio.online ? (
        <p className="maker">
          🖥️ <strong>Image studio on this computer.</strong> Private, and works offline.
          {recipe.referenceImage && ' Your reference picture will guide the look.'}
        </p>
      ) : assistant.canDraw ? (
        <p className="maker">
          🌐 <strong>Online assistant, as an illustration.</strong> It will draw your description as a simple illustration.
          {recipe.referenceImage && assistant.canSeePictures && ' It will look at your reference picture too.'} This can
          take up to a minute.
        </p>
      ) : (
        <p className="maker">
          ✏️ <strong>Sketch preview.</strong> No image studio is set up on this computer yet, so I’ll lay out your recipe as a sketch.
          The steps are exactly the same, so everything you learn here carries over.
        </p>
      )}

      {problem && <p className="problem">{problem}</p>}

      <div className="panel__actions">
        <button className="button button--quiet" onClick={onDone}>
          Not yet
        </button>
        <button
          className="button button--primary"
          disabled={!sent.trim()}
          onClick={() => {
            createPicture(recipe, sent.trim());
            onDone();
          }}
        >
          ✨ Create picture
        </button>
      </div>
    </>
  );
}

function MadeRecipe({ recipe, cardId }: { recipe: Recipe; cardId: string }) {
  const project = useBoard((s) => s.project);
  const start = project.cards.find((c) => c.id === recipe.startCardId);
  const openRecipe = useBoard.getState().openRecipe;
  const versions = creationsFrom(project, recipe.startCardId);
  const index = versions.findIndex((c) => c.id === cardId);
  const previous = index > 0 ? versions[index - 1] : undefined;
  const changes = previous?.recipe ? compareRecipes(previous.recipe, recipe) : undefined;
  const nothingChanged = changes && !changes.added.length && !changes.removed.length && !changes.reworded.length && !changes.wordsChanged;

  return (
    <>
      <h2 id="recipe-title">How this was made</h2>
      <p className="panel__lead">
        Made with <strong>{recipe.madeWith ?? 'your computer'}</strong>
        {recipe.createdAt && ` on ${new Date(recipe.createdAt).toLocaleString()}`}.
        {versions.length > 1 && index >= 0 && ` Version ${index + 1} of ${versions.length}.`}
      </p>

      <h3>
        <span className="step">1</span> The cards that went in
      </h3>
      <Ingredients items={recipe.ingredients} />

      <h3>
        <span className="step">2</span> What the AI read
      </h3>
      <blockquote className="sent">{recipe.sent ?? recipe.description}</blockquote>
      {recipe.sent && recipe.sent !== recipe.description && (
        <p className="muted">These words were changed from the board’s original: “{recipe.description}”</p>
      )}

      {previous && changes && (
        <>
          <h3>
            <span className="step">3</span> What changed since the last version
          </h3>
          <div className="compare">
            <figure>
              <img src={previous.image} alt="The previous version" />
              <figcaption>Before</figcaption>
            </figure>
            <figure>
              <img src={project.cards.find((c) => c.id === cardId)?.image} alt="This version" />
              <figcaption>This version</figcaption>
            </figure>
          </div>
          <ul className="changes">
            {changes.added.map((i) => (
              <li key={`a${i.cardId}`}>➕ Added {i.role === 'reference' ? 'a reference picture' : `“${i.text}”`}</li>
            ))}
            {changes.removed.map((i) => (
              <li key={`r${i.cardId}`}>➖ Removed {i.role === 'reference' ? 'a reference picture' : `“${i.text}”`}</li>
            ))}
            {changes.reworded.map(({ before, after }) => (
              <li key={`w${after.cardId}`}>
                ✏️ Changed “{before.text}” to “{after.text}”
              </li>
            ))}
            {nothingChanged && <li>Nothing on the board changed. The difference comes from the AI itself: it rarely makes the same picture twice.</li>}
          </ul>
        </>
      )}

      <p className="gentle-tip">
        💡 Look closely: what did the AI get right, and what did it miss? Change one card or connection, then make another
        version, to see what each piece does.
      </p>

      {start && (
        <div className="panel__actions">
          <button className="button button--primary" onClick={() => openRecipe({ cardId: start.id, mode: 'preview' })}>
            🔁 Make another version
          </button>
        </div>
      )}
    </>
  );
}
