import { del, get, set } from 'idb-keyval';
import type { Project } from '../model/types';
import { saveTextFile } from '../platform';

/**
 * Projects live on this computer, in the browser's own storage. Nothing is
 * uploaded. People can also save a project as a file and open it again later,
 * so they always own their work.
 */

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: number;
}

const INDEX = 'projects:index';
const key = (id: string) => `project:${id}`;
const LAST = 'workshop:last-project';
const START_FRESH = 'workshop:start-fresh';

export function newProject(name = 'My first board'): Project {
  const now = Date.now();
  return { id: crypto.randomUUID(), name, cards: [], links: [], viewport: { x: 0, y: 0, zoom: 1 }, createdAt: now, updatedAt: now, version: 1 };
}

export async function listProjects(): Promise<ProjectSummary[]> {
  return ((await get<ProjectSummary[]>(INDEX)) ?? []).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function saveProject(project: Project): Promise<void> {
  await set(key(project.id), project);
  const index = (await get<ProjectSummary[]>(INDEX)) ?? [];
  const summary = { id: project.id, name: project.name, updatedAt: project.updatedAt };
  await set(INDEX, [summary, ...index.filter((p) => p.id !== project.id)]);
  try {
    localStorage.setItem(LAST, project.id);
  } catch {
    // Remembering the last project is a convenience only.
  }
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return get<Project>(key(id));
}

export async function deleteProject(id: string): Promise<void> {
  await del(key(id));
  const index = (await get<ProjectSummary[]>(INDEX)) ?? [];
  await set(INDEX, index.filter((p) => p.id !== id));
}

/** Opens a new, empty board on the next load instead of the last one. Nothing is deleted. */
export function startFreshNextTime() {
  try {
    sessionStorage.setItem(START_FRESH, '1');
  } catch {
    // Storage is blocked: the next load starts fresh anyway.
  }
}

/** Called once the fresh board is open, so later loads open the last board again. */
export function freshBoardOpened() {
  try {
    sessionStorage.removeItem(START_FRESH);
  } catch {
    // Nothing to clear.
  }
}

export async function loadLastProject(): Promise<Project | undefined> {
  let id: string | null = null;
  try {
    // Not cleared here: in development React starts the app twice, and both starts must see it.
    if (sessionStorage.getItem(START_FRESH)) return undefined;
    id = localStorage.getItem(LAST);
  } catch {
    // Fall through to the most recent project.
  }
  if (id) {
    const p = await loadProject(id);
    if (p) return p;
  }
  const [recent] = await listProjects();
  return recent ? loadProject(recent.id) : undefined;
}

/** Save the project as a file the person keeps. */
export function exportProject(project: Project): Promise<boolean> {
  const name = `${project.name.replace(/[^\w\- ]+/g, '').trim() || 'board'}.workshop.json`;
  return saveTextFile(name, JSON.stringify(project));
}

export async function importProject(file: File): Promise<Project> {
  const data = JSON.parse(await file.text()) as Partial<Project>;
  if (data.version !== 1 || !Array.isArray(data.cards) || !Array.isArray(data.links)) {
    throw new Error('This file does not look like a Workshop board.');
  }
  return {
    ...newProject(data.name ?? 'Opened board'),
    cards: data.cards,
    links: data.links,
    viewport: data.viewport ?? { x: 0, y: 0, zoom: 1 },
  };
}
