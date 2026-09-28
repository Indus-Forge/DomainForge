/**
 * Web search, so the Research tool works from real, linked sources instead of
 * an assistant's memory. Two ways:
 *  - SearXNG: a search server you run yourself. It asks public search engines
 *    for you, without an account or tracking.
 *  - Tavily: an online search service made for AI, with a free monthly allowance.
 *    Needs the person's own key, and is switched off in educator mode.
 */

import { localFetch } from '../platform';
import { trimBase } from './openaiCompat';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export type SearchKind = 'searxng' | 'tavily';

export interface SearchStatus {
  searxng: boolean;
  /** Why SearXNG isn't usable, when it answered but something is off. */
  searxngProblem?: string;
}

export const NO_SEARCH: SearchStatus = { searxng: false };

export const SEARCH_NAMES: Record<SearchKind, string> = {
  searxng: 'your SearXNG search server',
  tavily: 'Tavily web search (online)',
};

function cleanResults(list: unknown, max: number): SearchResult[] {
  if (!Array.isArray(list)) return [];
  return list
    .map((r: { title?: unknown; url?: unknown; content?: unknown }) => ({
      title: String(r?.title ?? '').trim(),
      url: String(r?.url ?? '').trim(),
      snippet: String(r?.content ?? '').replace(/\s+/g, ' ').trim().slice(0, 400),
    }))
    .filter((r) => r.title && /^https?:\/\//.test(r.url))
    .slice(0, max);
}

/** SearXNG's JSON answer: {results: [{title, url, content}]}. */
export const parseSearxng = (data: unknown, max = 6) => cleanResults((data as { results?: unknown })?.results, max);
/** Tavily's answer: {results: [{title, url, content}]}. */
export const parseTavily = (data: unknown, max = 6) => cleanResults((data as { results?: unknown })?.results, max);

async function searxng(baseUrl: string, query: string): Promise<SearchResult[]> {
  const res = await localFetch(`${trimBase(baseUrl)}/search?q=${encodeURIComponent(query)}&format=json`, { signal: AbortSignal.timeout(15000) });
  if (res.status === 403) throw new Error('SearXNG answered, but its JSON results are switched off. Add “json” under search → formats in its settings.yml.');
  if (!res.ok) throw new Error('Your SearXNG server couldn’t search.');
  return parseSearxng(await res.json());
}

async function tavily(key: string, query: string): Promise<SearchResult[]> {
  const res = await localFetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` },
    body: JSON.stringify({ query, max_results: 6, search_depth: 'basic' }),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 401 || res.status === 403) throw new Error('Tavily didn’t accept your key. Check it in Admin.');
  if (res.status === 429 || res.status === 432) throw new Error('Your Tavily allowance is used up for now.');
  if (!res.ok) throw new Error('Tavily couldn’t search right now.');
  return parseTavily(await res.json());
}

export async function checkSearch(searxngUrl: string): Promise<SearchStatus> {
  if (!searxngUrl.trim()) return NO_SEARCH;
  try {
    await searxng(searxngUrl, 'test');
    return { searxng: true };
  } catch (err) {
    const message = (err as Error).message;
    return { searxng: false, searxngProblem: message.startsWith('SearXNG answered') ? message : 'Not answering' };
  }
}

/** Which search is ready: your own server first, then Tavily. Tavily is online, so never in educator mode. */
export function pickSearch(status: SearchStatus, tavilyKey: string, educatorMode: boolean): SearchKind | null {
  if (status.searxng) return 'searxng';
  if (tavilyKey.trim() && !educatorMode) return 'tavily';
  return null;
}

export async function searchWeb(kind: SearchKind, settings: { searxngUrl: string; tavilyKey: string }, query: string): Promise<SearchResult[]> {
  return kind === 'searxng' ? searxng(settings.searxngUrl, query) : tavily(settings.tavilyKey, query);
}

/** The search results, numbered, as material for the assistant. */
export function resultsAsMaterial(results: SearchResult[]): string {
  return results.map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\n(${r.url})`).join('\n\n');
}

/** A plain list of sources to put under research notes. */
export function sourcesList(results: SearchResult[]): string {
  return results.map((r, i) => `[${i + 1}] ${r.title} · ${r.url}`).join('\n');
}
