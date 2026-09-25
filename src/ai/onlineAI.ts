/**
 * The online assistant: Claude, reached through the page it is shown in.
 *
 * This only exists when Workshop is opened as a shared preview on claude.ai.
 * It is always labelled as online, it is only used when no private assistant
 * is running, and educator mode switches it off entirely.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sample = any;

export interface OnlineAIStatus {
  available: boolean;
  canSeePictures: boolean;
}

export const NO_ONLINE: OnlineAIStatus = { available: false, canSeePictures: false };

let samplePromise: Promise<Sample | null> | undefined;

function getSample(): Promise<Sample | null> {
  const claude = (globalThis as any).claude;
  if (!claude?.use) return Promise.resolve(null);
  samplePromise ??= Promise.resolve(claude.use('sample')).catch(() => null);
  return samplePromise;
}

export async function checkOnlineAI(): Promise<OnlineAIStatus> {
  const sample = await getSample();
  if (!sample) return NO_ONLINE;
  const limits = await sample.limits?.().catch(() => null);
  return { available: true, canSeePictures: Boolean(limits?.images) };
}

const FRIENDLY: Record<string, string> = {
  not_granted: 'The online assistant wasn’t allowed to help. You can still build boards and make sketches.',
  sampling_disabled: 'The online assistant isn’t available on this account.',
  rate_limited: 'The online assistant is busy right now. Try again in a moment.',
  session_expired: 'Please sign in to Claude again, then try once more.',
  refused: 'The online assistant declined this one. Try describing it differently.',
  empty_completion: 'The online assistant didn’t come up with anything. Try asking for something simpler.',
  invalid_json: 'The online assistant’s answer came back in the wrong shape. Try again.',
  prompt_too_large: 'That’s a lot of text for the assistant at once. Try connecting fewer cards.',
  cancelled: 'Stopped.',
};

function friendly(e: any): Error {
  const code = e?.code as string | undefined;
  return new Error((code && FRIENDLY[code]) || 'The online assistant couldn’t answer just now. Try again in a moment.');
}

/** Turns a callback stream into an async generator of new text pieces. */
async function* stream(run: (push: (delta: string) => void) => Promise<unknown>): AsyncGenerator<string> {
  const queue: string[] = [];
  let done = false;
  let error: unknown;
  let wake: (() => void) | null = null;
  run((delta) => {
    queue.push(delta);
    wake?.();
  }).then(
    () => {
      done = true;
      wake?.();
    },
    (e) => {
      error = e;
      done = true;
      wake?.();
    },
  );
  for (;;) {
    if (queue.length) {
      yield queue.shift()!;
      continue;
    }
    if (done) {
      if (error) throw friendly(error);
      return;
    }
    await new Promise<void>((r) => (wake = r));
    wake = null;
  }
}

export interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

export async function* onlineChat(instructions: string, turns: Turn[], signal?: AbortSignal): AsyncGenerator<string> {
  const sample = await getSample();
  if (!sample) throw new Error('The online assistant isn’t available here.');
  const input: Turn[] = [{ role: 'user', content: instructions }, ...turns];
  yield* stream((push) => sample(input, { cache: false, signal, onText: ({ delta }: { delta: string }) => push(delta) }));
}

export async function onlineAsk(instructions: string, text: string, quick = true): Promise<string> {
  const sample = await getSample();
  if (!sample) throw new Error('The online assistant isn’t available here.');
  try {
    const { text: answer } = await sample(`${instructions}\n\n${text}`, quick ? { modelTier: 'quick' } : {});
    return answer.trim();
  } catch (e) {
    throw friendly(e);
  }
}

export async function onlineJSON<T>(instructions: string, text: string): Promise<T> {
  const sample = await getSample();
  if (!sample) throw new Error('The online assistant isn’t available here.');
  try {
    return (await sample.json(`${instructions}\n\n${text}`)) as T;
  } catch (e) {
    throw friendly(e);
  }
}

async function toBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export async function onlineDescribe(instructions: string, dataUrl: string): Promise<string> {
  const sample = await getSample();
  if (!sample) throw new Error('The online assistant isn’t available here.');
  try {
    const { text } = await sample(instructions, { images: await toBlob(dataUrl), modelTier: 'quick' });
    return text.trim();
  } catch (e) {
    throw friendly(e);
  }
}

/** Asks for an SVG illustration. Returns the raw reply; the caller extracts and cleans the SVG. */
export async function onlineDraw(instructions: string, referenceImage?: string, canSeePictures = false): Promise<string> {
  const sample = await getSample();
  if (!sample) throw new Error('The online assistant isn’t available here.');
  const options: Record<string, unknown> = { cache: false };
  if (referenceImage && canSeePictures) options.images = await toBlob(referenceImage);
  try {
    const { text } = await sample(instructions, options);
    return text;
  } catch (e) {
    throw friendly(e);
  }
}

/** Offers a file to the viewer through the preview's own save prompt. Returns false when unavailable. */
export async function onlineSave(filename: string, data: string | Blob): Promise<boolean> {
  const claude = (globalThis as any).claude;
  if (!claude?.use) return false;
  const downloads = await Promise.resolve(claude.use('downloads')).catch(() => null);
  if (!downloads) return false;
  try {
    await downloads.save({ filename, data });
    return true;
  } catch (e: any) {
    if (e?.code === 'declined') return true;
    throw new Error('This preview couldn’t save the file.');
  }
}
