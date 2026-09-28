import { describe, expect, it } from 'vitest';
import { connectionReport } from '../src/ai/connections';
import { parseSearxng, parseTavily, pickSearch, resultsAsMaterial, sourcesList } from '../src/ai/search';
import { voiceNames } from '../src/ai/voice';
import { readSettingsFile, settingsFile } from '../src/store/settingsFile';
import { DEFAULT_CONNECTIONS, type Settings } from '../src/store/board';

const settings = (patch: Partial<Settings['connections']> = {}, educatorMode = false): Settings => ({
  educatorMode,
  classroom: false,
  teacherPin: '',
  storage: 'keep',
  theme: 'neon',
  connections: { ...DEFAULT_CONNECTIONS, ...patch },
});

type Sources = Parameters<typeof connectionReport>[0];

const nothing: Sources = {
  privateAI: { online: false, models: [], installed: [] },
  onlineAI: { available: false, canSeePictures: false },
  localAI: { online: false, models: [] },
  hf: { connected: false },
  studio: { online: false },
  voice: { online: false, voices: [] },
  search: { searxng: false },
  settings: settings(),
};

const ready = (s: Sources) => Object.fromEntries(connectionReport(s).map((r) => [r.id, r.ready]));

describe('what is connected', () => {
  it('reports every capability as missing, with what it needs, when nothing is connected', () => {
    const report = connectionReport(nothing);
    expect(report.map((r) => r.id)).toEqual(['chat', 'vision', 'pictures', 'voice', 'search', 'enlarge']);
    expect(report.every((r) => !r.ready && r.need)).toBe(true);
    expect(report.find((r) => r.id === 'voice')!.now).toMatch(/built-in voice/);
  });

  it('a Hugging Face token connects chat, reading pictures and pictures', () => {
    const s = { ...nothing, hf: { connected: true, name: 'me' }, settings: settings({ hfToken: 'hf_x' }) };
    expect(ready(s)).toMatchObject({ chat: true, vision: true, pictures: true, voice: false, search: false, enlarge: false });
  });

  it('educator mode switches the online ones off', () => {
    const s = { ...nothing, hf: { connected: true }, settings: settings({ hfToken: 'hf_x', tavilyKey: 'tvly-x' }, true) };
    expect(ready(s)).toMatchObject({ chat: false, pictures: false, search: false });
  });

  it('counts the voice server, web search and the image studio', () => {
    const s = {
      ...nothing,
      voice: { online: true, baseUrl: 'http://127.0.0.1:8880/v1', voices: ['af_heart'] },
      search: { searxng: true },
      studio: { online: true, baseUrl: 'http://127.0.0.1:7860' },
    };
    expect(ready(s)).toMatchObject({ voice: true, search: true, enlarge: true, pictures: true });
  });
});

describe('web search', () => {
  const answer = {
    results: [
      { title: 'Honey bee', url: 'https://en.wikipedia.org/wiki/Honey_bee', content: 'A honey bee is a eusocial   flying insect.' },
      { title: '', url: 'https://example.com', content: 'no title' },
      { title: 'Not a link', url: 'javascript:alert(1)', content: 'x' },
    ],
  };

  it('reads SearXNG and Tavily results, dropping untitled and non-web links', () => {
    for (const parse of [parseSearxng, parseTavily]) {
      expect(parse(answer)).toEqual([{ title: 'Honey bee', url: 'https://en.wikipedia.org/wiki/Honey_bee', snippet: 'A honey bee is a eusocial flying insect.' }]);
    }
    expect(parseSearxng({})).toEqual([]);
  });

  it('prefers your own server, and never uses Tavily in educator mode', () => {
    expect(pickSearch({ searxng: true }, 'tvly-x', false)).toBe('searxng');
    expect(pickSearch({ searxng: false }, 'tvly-x', false)).toBe('tavily');
    expect(pickSearch({ searxng: false }, 'tvly-x', true)).toBeNull();
    expect(pickSearch({ searxng: false }, '', false)).toBeNull();
  });

  it('numbers the sources so the notes can cite them', () => {
    const results = parseTavily(answer);
    expect(resultsAsMaterial(results)).toContain('[1] Honey bee');
    expect(sourcesList(results)).toBe('[1] Honey bee · https://en.wikipedia.org/wiki/Honey_bee');
  });
});

describe('voice lists', () => {
  it('reads the shapes speech servers use', () => {
    expect(voiceNames({ voices: ['af_heart', 'bm_george'] })).toEqual(['af_heart', 'bm_george']);
    expect(voiceNames([{ id: 'alloy' }, { name: 'nova' }])).toEqual(['alloy', 'nova']);
    expect(voiceNames({ nothing: true })).toEqual([]);
  });
});

describe('settings file', () => {
  const mine = settings({ ollamaKey: 'ollama_secret', hfToken: 'hf_secret', tavilyKey: 'tvly-secret', voiceName: 'bm_george', searxngUrl: 'http://127.0.0.1:8080' });

  it('leaves access keys out unless asked', () => {
    expect(settingsFile(mine, false)).not.toContain('secret');
    expect(settingsFile(mine, true)).toContain('hf_secret');
    expect(settingsFile(mine, true)).toContain('ollama_secret');
  });

  it('reads back known settings only, and never wipes a saved key with an empty one', () => {
    const { connections, other } = readSettingsFile(settingsFile(mine, false));
    expect(connections).toMatchObject({ voiceName: 'bm_george', searxngUrl: 'http://127.0.0.1:8080' });
    expect(connections).not.toHaveProperty('hfToken');
    expect(connections).not.toHaveProperty('ollamaKey');
    expect(other).toEqual({ educatorMode: false, classroom: false });
    const odd = readSettingsFile(JSON.stringify({ workshopSettings: 1, connections: { voiceName: 5, picturesWith: 'sketch', hacker: 'x', localVision: true } }));
    expect(odd.connections).toEqual({ localVision: true });
  });

  it('carries classroom mode to other computers, and the PIN only with the keys', () => {
    const teacher = { ...mine, classroom: true, teacherPin: '4321' };
    expect(readSettingsFile(settingsFile(teacher, false)).other).toEqual({ educatorMode: false, classroom: true });
    expect(readSettingsFile(settingsFile(teacher, true)).other.teacherPin).toBe('4321');
  });

  it('refuses files that are not Workshop settings', () => {
    expect(() => readSettingsFile('not json')).toThrow(/isn’t a Workshop settings file/);
    expect(() => readSettingsFile('{"connections":{}}')).toThrow(/isn’t a Workshop settings file/);
  });
});
