import type { Recipe } from '../model/types';
import { useBoard } from '../store/board';
import { makePicture, type MadePicture } from './imageEngine';
import { hfPicture } from './huggingface';
import { bringCardsIntoView } from '../canvas/Canvas';
import { imageRatio } from '../canvas/images';

/** Only real image models make pictures. There is no fallback that fakes one. */
export type PictureMaker = 'studio' | 'huggingface';

export const PICTURE_MAKER_NAMES: Record<PictureMaker, string> = {
  studio: 'Image studio on this computer',
  huggingface: 'Hugging Face (online)',
};

export const NO_PICTURE_MODEL =
  'No picture model is connected, so no picture can be made. Open the AI Hub and add a free Hugging Face token, or connect an image studio on this computer.';

/** Which picture makers are ready right now. */
export function pictureMakersReady(): Record<PictureMaker, boolean> {
  const { studio, hf, settings } = useBoard.getState();
  return {
    studio: studio.online,
    huggingface: !settings.educatorMode && hf.connected && Boolean(settings.connections.hfToken),
  };
}

/**
 * Chooses how to make a picture: the route picked in the AI Hub if it is
 * ready, otherwise the image studio on this computer, then Hugging Face.
 * Returns null when no real picture model is connected.
 */
export function choosePictureMaker(): PictureMaker | null {
  const route = useBoard.getState().settings.connections.picturesWith;
  const ready = pictureMakersReady();
  if (route !== 'auto' && ready[route]) return route;
  return (['studio', 'huggingface'] as PictureMaker[]).find((m) => ready[m]) ?? null;
}

async function picture(recipe: Recipe, sent: string): Promise<MadePicture> {
  const { studio, settings } = useBoard.getState();
  switch (choosePictureMaker()) {
    case 'studio':
      return makePicture(studio, sent, recipe.referenceImage);
    case 'huggingface': {
      const c = settings.connections;
      const image = await hfPicture(c.hfToken, c.hfPictureModel, sent);
      useBoard.getState().learn('online-assistant');
      return { image, how: 'studio', madeWith: `Hugging Face (online), ${c.hfPictureModel.split('/').pop()}` };
    }
    case null:
      throw new Error(NO_PICTURE_MODEL);
  }
}

/** Places a creation on the board, then fills it in. Does nothing without a picture model. */
export async function createPicture(recipe: Recipe, sent: string) {
  if (!choosePictureMaker()) {
    useBoard.getState().setHubOpen(true);
    return;
  }
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
    const h = card ? Math.round((card.w - 20) * Math.min(ratio, 1.5)) + 86 : undefined;
    updateCard(id, { image: result.image, status: undefined, h, recipe: { ...made, madeWith: result.madeWith, how: result.how } });
    learn('first-creation');
    const { project } = useBoard.getState();
    const earlier = project.links.filter((l) => l.kind === 'origin' && l.from === recipe.startCardId).length;
    if (earlier > 1) learn('compare-versions');
  } catch (err) {
    updateCard(id, { status: 'error', statusMessage: (err as Error).message });
  }
}
