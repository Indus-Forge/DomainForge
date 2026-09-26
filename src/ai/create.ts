import type { Recipe } from '../model/types';
import { useBoard } from '../store/board';
import { makePicture, sketch, type MadePicture } from './imageEngine';
import { drawIllustration, pickAssistant } from './assistant';
import { bringCardsIntoView } from '../canvas/Canvas';
import { imageRatio, toStoredImage } from '../canvas/images';

/**
 * Chooses how to make a picture, most capable first:
 * the image studio on this computer, then an illustration drawn by the
 * online assistant, then a sketch preview. Each result says which it was.
 */
async function picture(recipe: Recipe, sent: string): Promise<MadePicture> {
  const { studio, privateAI, onlineAI, settings } = useBoard.getState();
  if (studio.online) return makePicture(studio, sent, recipe.referenceImage);
  const assistant = pickAssistant(privateAI, onlineAI, !settings.educatorMode);
  if (assistant.canDraw) {
    const svg = await drawIllustration(sent, recipe.referenceImage);
    const { image } = await toStoredImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    return {
      image,
      how: 'illustration',
      madeWith: recipe.referenceImage && assistant.canSeePictures ? 'Online assistant, drawn as an illustration guided by your picture' : 'Online assistant, drawn as an illustration',
    };
  }
  return { image: await sketch(sent, recipe.referenceImage), madeWith: 'Sketch preview', how: 'sketch' };
}

/** Places a creation on the board, then fills it in. */
export async function createPicture(recipe: Recipe, sent: string) {
  const { startCreation, updateCard, learn } = useBoard.getState();
  const made: Recipe = { ...recipe, sent, createdAt: Date.now() };
  const id = startCreation(recipe.startCardId, made);
  if (!id) return;
  bringCardsIntoView([id]);
  try {
    const result = await picture(recipe, sent);
    // Fit the card to the picture so none of it is cropped.
    const card = useBoard.getState().project.cards.find((c) => c.id === id);
    const ratio = await imageRatio(result.image).catch(() => 1);
    const h = card ? Math.round((card.w - 20) * Math.min(ratio, 1.5)) + 86 + (result.how === 'sketch' ? 40 : 0) : undefined;
    updateCard(id, { image: result.image, status: undefined, h, recipe: { ...made, madeWith: result.madeWith, how: result.how } });
    learn('first-creation');
    if (result.how === 'sketch') learn('sketch-made');
    if (result.how === 'illustration') learn('illustration-made');
    const { project } = useBoard.getState();
    const earlier = project.links.filter((l) => l.kind === 'origin' && l.from === recipe.startCardId).length;
    if (earlier > 1) learn('compare-versions');
  } catch (err) {
    updateCard(id, { status: 'error', statusMessage: (err as Error).message });
  }
}
