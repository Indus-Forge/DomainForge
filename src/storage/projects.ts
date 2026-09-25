import { del, get, set } from 'idb-keyval';
import type { Project } from '../model/types';

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

export async function loadLastProject(): Promise<Project | undefined> {
  let id: string | null = null;
  try {
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

/** Download the project as a file the person keeps. */
export function exportProject(project: Project): void {
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${project.name.replace(/[^\w\- ]+/g, '').trim() || 'board'}.workshop.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
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
