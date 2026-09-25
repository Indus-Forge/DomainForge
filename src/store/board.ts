import { create } from 'zustand';
import type { Card, CardKind, Link, Project, Recipe, Viewport } from '../model/types';
import { CARD_INFO, suggestLinkLabel } from '../model/cards';
import { newProject } from '../storage/projects';
import { findFreeSpot } from './layout';
import type { LearnEvent } from '../learn/tips';
import type { Plan } from '../ai/producer';
import { OFFLINE, type PrivateAIStatus } from '../ai/privateAI';
import { NO_STUDIO, type ImageStudioStatus } from '../ai/imageEngine';
import { NO_ONLINE, type OnlineAIStatus } from '../ai/onlineAI';

type Snapshot = Pick<Project, 'cards' | 'links'>;

export interface RecipeView {
  cardId: string;
  /** 'preview' before creating; 'made' when looking back at a creation. */
  mode: 'preview' | 'made';
}

interface State {
  project: Project;
  loaded: boolean;
  selectedId: string | null;
  past: Snapshot[];
  future: Snapshot[];
  discovered: LearnEvent[];
  /** Discoveries waiting to be shown, one at a time. */
  toasts: LearnEvent[];
  recipeView: RecipeView | null;
  privateAI: PrivateAIStatus;
  onlineAI: OnlineAIStatus;
  studio: ImageStudioStatus;
  settings: Settings;
  /** Presenting the board as slides. */
  presenting: boolean;
  saveState: 'saved' | 'saving';
  sidebarOpen: boolean;

  setProject(project: Project): void;
  renameProject(name: string): void;
  setViewport(viewport: Viewport): void;
  select(id: string | null): void;

  /** Remember the board as it is now, so it can be undone. Call before a change. */
  checkpoint(): void;
  undo(): void;
  redo(): void;

  /** Adds a card near `at`, nudged so it never covers another card unless `exact` is set. */
  addCard(kind: CardKind, at: { x: number; y: number }, patch?: Partial<Card>, options?: { exact?: boolean }): string;
  updateCard(id: string, patch: Partial<Card>): void;
  deleteCard(id: string): void;
  addLink(from: string, to: string): void;
  updateLink(id: string, patch: Partial<Link>): void;
  deleteLink(id: string): void;
  /** Changes links without an undo step of its own (used right after an action that already made one). */
  updateProjectLinks(fn: (links: Link[]) => Link[]): void;
  /** Lays out a plan's steps as connected cards, and returns their ids. */
  placePlan(plan: Plan, center: { x: number; y: number }): string[];
  startCreation(startId: string, recipe: Recipe): string;

  learn(event: LearnEvent): void;
  dismissToast(): void;
  openRecipe(view: RecipeView | null): void;
  setPrivateAI(status: PrivateAIStatus): void;
  setOnlineAI(status: OnlineAIStatus): void;
  setSettings(patch: Partial<Settings>): void;
  setPresenting(on: boolean): void;
  setStudio(status: ImageStudioStatus): void;
  setSaveState(state: 'saved' | 'saving'): void;
  toggleSidebar(open?: boolean): void;
}

export interface Settings {
  /** Keep everything on this computer: never use the online assistant. */
  educatorMode: boolean;
  /** Smart storage: 'keep' never suggests removing tools; 'tidy' suggests it when space runs low. */
  storage: 'keep' | 'tidy';
}

const DISCOVERED_KEY = 'workshop:discovered';
const SETTINGS_KEY = 'workshop:settings';
const DEFAULT_SETTINGS: Settings = { educatorMode: false, storage: 'keep' };

function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadDiscovered(): LearnEvent[] {
  try {
    return JSON.parse(localStorage.getItem(DISCOVERED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

const snapshot = (p: Project): Snapshot => ({ cards: p.cards, links: p.links });

export const useBoard = create<State>((set, get) => {
  const change = (fn: (p: Project) => Partial<Project>) =>
    set((s) => ({ project: { ...s.project, ...fn(s.project), updatedAt: Date.now() } }));

  return {
    project: newProject(),
    loaded: false,
    selectedId: null,
    past: [],
    future: [],
    discovered: loadDiscovered(),
    toasts: [],
    recipeView: null,
    privateAI: OFFLINE,
    onlineAI: NO_ONLINE,
    studio: NO_STUDIO,
    settings: loadSettings(),
    presenting: false,
    saveState: 'saved',
    sidebarOpen: true,

    setProject: (project) => set({ project, loaded: true, past: [], future: [], selectedId: null, recipeView: null }),
    renameProject: (name) => change(() => ({ name })),
    setViewport: (viewport) => set((s) => ({ project: { ...s.project, viewport } })),
    select: (selectedId) => set({ selectedId }),

    checkpoint: () => set((s) => ({ past: [...s.past.slice(-49), snapshot(s.project)], future: [] })),
    undo: () => {
      const { past, project } = get();
      const prev = past.at(-1);
      if (!prev) return;
      set((s) => ({ past: past.slice(0, -1), future: [snapshot(project), ...s.future], selectedId: null }));
      change(() => prev);
    },
    redo: () => {
      const { future, project } = get();
      const next = future[0];
      if (!next) return;
      set((s) => ({ future: future.slice(1), past: [...s.past, snapshot(project)], selectedId: null }));
      change(() => next);
    },

    addCard: (kind, at, patch, options) => {
      get().checkpoint();
      const info = CARD_INFO[kind];
      const w = patch?.w ?? info.w;
      const h = patch?.h ?? info.h;
      const wanted = { x: Math.round(at.x - w / 2), y: Math.round(at.y - h / 2) };
      const spot = options?.exact ? wanted : findFreeSpot(get().project.cards, w, h, [wanted]);
      const card: Card = { id: crypto.randomUUID(), kind, ...spot, w, h, text: '', ...patch };
      change((p) => ({ cards: [...p.cards, card] }));
      set({ selectedId: card.id });
      return card.id;
    },
    updateCard: (id, patch) => change((p) => ({ cards: p.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    deleteCard: (id) => {
      get().checkpoint();
      change((p) => ({
        cards: p.cards.filter((c) => c.id !== id),
        links: p.links.filter((l) => l.from !== id && l.to !== id),
      }));
      set((s) => ({ selectedId: s.selectedId === id ? null : s.selectedId }));
    },

    addLink: (from, to) => {
      if (from === to) return;
      const { project, learn } = get();
      const exists = project.links.some((l) => (l.from === from && l.to === to) || (l.from === to && l.to === from));
      const a = project.cards.find((c) => c.id === from);
      const b = project.cards.find((c) => c.id === to);
      if (exists || !a || !b) return;
      get().checkpoint();
      change((p) => ({ links: [...p.links, { id: crypto.randomUUID(), from, to, label: suggestLinkLabel(a.kind, b.kind) }] }));

      learn('first-link');
      const kinds = [a.kind, b.kind];
      if (kinds.includes('creation')) learn('iteration');
      else if (kinds.includes('picture')) learn('reference-linked');
      if (kinds.includes('character')) learn('character-linked');
      if (kinds.includes('style')) learn('style-linked');
    },
    updateLink: (id, patch) => {
      get().checkpoint();
      change((p) => ({ links: p.links.map((l) => (l.id === id ? { ...l, ...patch } : l)) }));
    },
    deleteLink: (id) => {
      get().checkpoint();
      change((p) => ({ links: p.links.filter((l) => l.id !== id) }));
    },

    updateProjectLinks: (fn) => change((p) => ({ links: fn(p.links) })),

    placePlan: (plan, center) => {
      get().checkpoint();
      const gap = 40;
      const widths = plan.steps.map((s) => CARD_INFO[s.kind].w);
      const total = widths.reduce((a, b) => a + b, 0) + gap * (plan.steps.length - 1);
      const tallest = Math.max(...plan.steps.map((s) => CARD_INFO[s.kind].h)) + 80;
      const existing = get().project.cards;
      const below = existing.length ? Math.max(...existing.map((c) => c.y + c.h)) + 120 : center.y;
      const origin = findFreeSpot(existing, total, tallest, [
        { x: center.x - total / 2, y: center.y - tallest / 2 },
        { x: center.x - total / 2, y: below },
      ]);
      let x = origin.x;
      const cards: Card[] = plan.steps.map((s, i) => {
        const info = CARD_INFO[s.kind];
        const card: Card = {
          id: crypto.randomUUID(),
          kind: s.kind,
          x: Math.round(x),
          y: Math.round(origin.y + (tallest - info.h) / 2 + (i % 2 ? 40 : -40)),
          w: info.w,
          h: info.h,
          text: '',
          title: s.title,
          hint: s.hint,
        };
        x += info.w + gap;
        return card;
      });
      const links: Link[] = cards.slice(1).map((c, i) => ({ id: crypto.randomUUID(), from: cards[i].id, to: c.id, label: 'then' }));
      change((p) => ({ cards: [...p.cards, ...cards], links: [...p.links, ...links] }));
      get().learn('plan-placed');
      return cards.map((c) => c.id);
    },

    startCreation: (startId, recipe) => {
      const start = get().project.cards.find((c) => c.id === startId);
      if (!start) return '';
      get().checkpoint();
      const info = CARD_INFO.creation;
      const creation: Card = {
        id: crypto.randomUUID(),
        kind: 'creation',
        ...findFreeSpot(get().project.cards, info.w, info.h, [
          { x: start.x + start.w + 90, y: start.y + start.h / 2 - info.h / 2 },
          { x: start.x + start.w / 2 - info.w / 2, y: start.y + start.h + 90 },
          { x: start.x - info.w - 90, y: start.y + start.h / 2 - info.h / 2 },
          { x: start.x + start.w / 2 - info.w / 2, y: start.y - info.h - 90 },
        ]),
        w: info.w,
        h: info.h,
        text: '',
        recipe,
        status: 'working',
      };
      change((p) => ({
        cards: [...p.cards, creation],
        links: [...p.links, { id: crypto.randomUUID(), from: startId, to: creation.id, label: 'made', kind: 'origin' }],
      }));
      return creation.id;
    },

    learn: (event) => {
      if (get().discovered.includes(event)) return;
      const discovered = [...get().discovered, event];
      try {
        localStorage.setItem(DISCOVERED_KEY, JSON.stringify(discovered));
      } catch {
        // Discoveries still show for this visit.
      }
      set((s) => ({ discovered, toasts: [...s.toasts, event] }));
    },
    dismissToast: () => set((s) => ({ toasts: s.toasts.slice(1) })),
    openRecipe: (recipeView) => {
      set({ recipeView });
      if (recipeView) get().learn('recipe-opened');
    },
    setPrivateAI: (privateAI) => set({ privateAI }),
    setOnlineAI: (onlineAI) => set({ onlineAI }),
    setSettings: (patch) => {
      const settings = { ...get().settings, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        // Settings still apply for this visit.
      }
      set({ settings });
    },
    setPresenting: (presenting) => set({ presenting, selectedId: null }),
    setStudio: (studio) => set({ studio }),
    setSaveState: (saveState) => set({ saveState }),
    toggleSidebar: (open) => set((s) => ({ sidebarOpen: open ?? !s.sidebarOpen })),
  };
});

/** Screen position → board position. */
export function toBoard(viewport: Viewport, screen: { x: number; y: number }) {
  return { x: (screen.x - viewport.x) / viewport.zoom, y: (screen.y - viewport.y) / viewport.zoom };
}
