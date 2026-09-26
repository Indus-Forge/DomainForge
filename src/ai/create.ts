import type { Recipe } from '../model/types';
import { useBoard } from '../store/board';
import { makePicture, sketch, type MadePicture } from './imageEngine';
import { drawIllustration, pickAssistant } from './assistant';
import { hfPicture } from './huggingface';
import { bringCardsIntoView } from '../canvas/Canvas';
import { imageRatio, toStoredImage } from '../canvas/images';

export type PictureMaker = 'studio' | 'huggingface' | 'online' | 'sketch';

export const PICTURE_MAKER_NAMES: Record<PictureMaker, string> = {
  studio: 'Image studio on this computer',
  huggingface: 'Hugging Face (online)',
  online: 'Online assistant, as an illustration',
  sketch: 'Sketch preview (no AI)',
};

/** Which picture makers are ready right now. */
export function pictureMakersReady(): Record<PictureMaker, boolean> {
  const { studio, hf, settings, privateAI, onlineAI } = useBoard.getState();
  const online = !settings.educatorMode;
  return {
    studio: studio.online,
    huggingface: online && hf.connected && Boolean(settings.connections.hfToken),
    online: online && pickAssistant(privateAI, onlineAI, online).canDraw,
    sketch: true,
  };
}

/**
 * Chooses how to make a picture. On "auto", most capable first: the image
 * studio on this computer, then Hugging Face, then an illustration drawn by
 * the online assistant, then a sketch preview. Each result says which it was.
 */
export function choosePictureMaker(): PictureMaker {
  const route = useBoard.getState().settings.connections.picturesWith;
  const ready = pictureMakersReady();
  if (route !== 'auto' && ready[route]) return route;
  return (['studio', 'huggingface', 'online', 'sketch'] as PictureMaker[]).find((m) => ready[m])!;
}

async function picture(recipe: Recipe, sent: string): Promise<MadePicture> {
  const { studio, settings } = useBoard.getState();
  const maker = choosePictureMaker();
  switch (maker) {
    case 'studio':
      return makePicture(studio, sent, recipe.referenceImage);
    case 'huggingface': {
      const c = settings.connections;
      const image = await hfPicture(c.hfToken, c.hfPictureModel, sent);
      useBoard.getState().learn('online-assistant');
      return { image, how: 'studio', madeWith: `Hugging Face (online), ${c.hfPictureModel.split('/').pop()}` };
    }
    case 'online': {
      const svg = await drawIllustration(sent, recipe.referenceImage);
      const { image } = await toStoredImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      return { image, how: 'illustration', madeWith: recipe.referenceImage ? 'Online assistant, drawn as an illustration guided by your picture' : 'Online assistant, drawn as an illustration' };
    }
    case 'sketch':
      return { image: await sketch(sent, recipe.referenceImage), madeWith: 'Sketch preview', how: 'sketch' };
  }
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
