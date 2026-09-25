/** Shrinks pictures before storing them, so boards stay quick and small. */
const MAX_SIDE = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be opened as a picture.'));
    img.src = src;
  });
}

export async function toStoredImage(src: string): Promise<{ image: string; ratio: number }> {
  const img = await loadImage(src);
  const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { image: canvas.toDataURL('image/jpeg', 0.9), ratio: canvas.height / canvas.width };
}

export async function readImageFile(file: File): Promise<{ image: string; ratio: number }> {
  const url = URL.createObjectURL(file);
  try {
    return await toStoredImage(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const isImageFile = (f: File) => f.type.startsWith('image/');
