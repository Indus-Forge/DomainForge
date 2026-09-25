/**
 * The AI Model Library: which private AI tools suit this computer, in plain words.
 *
 * Sizes are approximate download sizes. "Memory" is what the tool needs to
 * run comfortably. People never see these numbers as requirements; they see
 * "runs comfortably", "might be slow" or "too big for this computer".
 */

export interface ModelInfo {
  /** The name the private AI runtime knows it by. Only shown in "technical details". */
  id: string;
  name: string;
  about: string;
  /** Approximate download size in GB. */
  sizeGB: number;
  /** Memory (GB) needed to run comfortably. */
  memoryGB: number;
  canSeePictures: boolean;
}

export const CATALOGUE: ModelInfo[] = [
  { id: 'llama3.2:1b', name: 'Tiny assistant', about: 'Quick and light. Good for planning and short writing on older computers.', sizeGB: 1.3, memoryGB: 4, canSeePictures: false },
  { id: 'llama3.2', name: 'Everyday assistant', about: 'A good all-rounder for chatting, planning and smoothing your wording.', sizeGB: 2.0, memoryGB: 8, canSeePictures: false },
  { id: 'moondream', name: 'Small picture reader', about: 'Looks at your pictures and describes them in a sentence.', sizeGB: 1.7, memoryGB: 4, canSeePictures: true },
  { id: 'gemma3:4b', name: 'Assistant that can see', about: 'Chats, writes and also understands pictures.', sizeGB: 3.3, memoryGB: 8, canSeePictures: true },
  { id: 'llava', name: 'Detailed picture reader', about: 'Gives richer descriptions of pictures.', sizeGB: 4.7, memoryGB: 8, canSeePictures: true },
  { id: 'qwen2.5:7b', name: 'Thoughtful writer', about: 'Slower, but better at scripts, research notes and longer writing.', sizeGB: 4.7, memoryGB: 16, canSeePictures: false },
];

export interface ComputerInfo {
  /** Total memory in GB, if known. */
  memoryGB?: number;
  /** Free space in GB where AI tools are stored, if known. */
  freeDiskGB?: number;
  cores?: number;
  /** True when the numbers are the browser's rough guess rather than measured. */
  estimated: boolean;
}

export type Fit = 'comfortable' | 'slow' | 'too-big' | 'unknown';

export function fitFor(model: ModelInfo, computer: ComputerInfo): Fit {
  if (computer.freeDiskGB !== undefined && computer.freeDiskGB < model.sizeGB + 1) return 'too-big';
  if (computer.memoryGB === undefined) return 'unknown';
  if (computer.memoryGB >= model.memoryGB) return 'comfortable';
  if (computer.memoryGB >= model.memoryGB * 0.6) return 'slow';
  return 'too-big';
}

export const FIT_WORDS: Record<Fit, string> = {
  comfortable: 'Runs comfortably on your computer',
  slow: 'Will work, but might be slow',
  'too-big': 'Too big for this computer',
  unknown: 'Should work on most computers',
};

/** A friendly one-line summary of what this computer can do. */
export function describeComputer(c: ComputerInfo): string {
  if (c.memoryGB === undefined) return 'We couldn’t check your computer, so recommendations are a best guess.';
  if (c.memoryGB >= 16) return 'Your computer can comfortably run all of these creative tools.';
  if (c.memoryGB >= 8) return 'Your computer can comfortably run the everyday tools. The largest ones may be slow.';
  if (c.memoryGB >= 4) return 'Your computer suits the small, light tools best.';
  return 'Your computer is on the small side for private AI. The tiny assistant is the best place to start.';
}

export function friendlySize(gb: number): string {
  if (gb < 1) return `about ${Math.max(1, Math.round(gb * 1000))} MB`;
  return `about ${gb < 10 ? gb.toFixed(1).replace(/\.0$/, '') : Math.round(gb)} GB`;
}

// ---------------------------------------------------------------------------
// Smart storage: remember when each tool was last used, so tidying up can be
// suggested. Nothing is ever removed without the person saying yes.

const USED_KEY = 'workshop:models-last-used';
const DAY = 24 * 60 * 60 * 1000;

function readUsed(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(USED_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function noteModelUsed(id: string | undefined): void {
  if (!id) return;
  try {
    localStorage.setItem(USED_KEY, JSON.stringify({ ...readUsed(), [id]: Date.now() }));
  } catch {
    // Only used for suggestions.
  }
}

export function lastUsed(id: string): number | undefined {
  return readUsed()[id];
}

export interface InstalledModel {
  id: string;
  sizeGB: number;
  installedAt?: number;
}

/**
 * Suggests which installed tools could be removed to free space: ones not
 * used for a month (or never used since they were installed a month ago),
 * largest first. Suggestions only.
 */
export function tidySuggestions(installed: InstalledModel[], now = Date.now(), used = readUsed()): InstalledModel[] {
  return installed
    .filter((m) => {
      const last = used[m.id] ?? m.installedAt;
      return last !== undefined && now - last > 30 * DAY;
    })
    .sort((a, b) => b.sizeGB - a.sizeGB);
}

export function catalogueEntry(id: string): ModelInfo | undefined {
  const base = id.replace(/:latest$/, '');
  return CATALOGUE.find((m) => m.id === base || m.id === id);
}
