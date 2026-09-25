import type { Recipe } from '../model/types';
import { useBoard } from '../store/board';
import { makePicture } from './imageEngine';
import { bringCardsIntoView } from '../canvas/Canvas';

/** Places a creation on the board, then asks the picture maker to fill it in. */
export async function createPicture(recipe: Recipe, sent: string) {
  const { startCreation, updateCard, studio, learn } = useBoard.getState();
  const made: Recipe = { ...recipe, sent, createdAt: Date.now() };
  const id = startCreation(recipe.startCardId, made);
  if (!id) return;
  bringCardsIntoView([id]);
  try {
    const result = await makePicture(studio, sent, recipe.referenceImage);
    updateCard(id, { image: result.image, status: undefined, recipe: { ...made, madeWith: result.madeWith } });
    learn('first-creation');
    if (result.isSketch) learn('sketch-made');
  } catch (err) {
    updateCard(id, { status: 'error', statusMessage: (err as Error).message });
  }
}
