import { describe, expect, it } from 'vitest';
import { pickFrom, type AISources } from '../src/ai/assistant';
import { parseSSE, parseJSONReply } from '../src/ai/openaiCompat';
import { DEFAULT_CONNECTIONS } from '../src/store/board';

const base: AISources = {
  privateAI: { online: false, models: [], installed: [] },
  onlineAI: { available: false, canSeePictures: false },
  localAI: { online: false, models: [] },
  hf: { connected: false },
  connections: DEFAULT_CONNECTIONS,
  educatorMode: false,
};
const withOllama = { ...base, privateAI: { online: true, models: ['llama3.2'], installed: [], chatModel: 'llama3.2' } };
const withHF = { ...base, hf: { connected: true, name: 'me' }, connections: { ...DEFAULT_CONNECTIONS, hfToken: 'hf_x' } };
const withLocal = { ...base, localAI: { online: true, models: ['qwen'] }, connections: { ...DEFAULT_CONNECTIONS, localUrl: 'http://127.0.0.1:1234/v1', localModel: 'qwen' } };

describe('choosing an assistant', () => {
  it('prefers private AI on auto', () => {
    expect(pickFrom({ ...withHF, privateAI: withOllama.privateAI }).kind).toBe('private');
    expect(pickFrom({ ...withHF, localAI: withLocal.localAI, connections: { ...withLocal.connections, hfToken: 'hf_x' } }).kind).toBe('local');
  });

  it('falls back to Hugging Face when nothing private is running', () => {
    const info = pickFrom(withHF);
    expect(info).toMatchObject({ kind: 'huggingface', isPrivate: false, canSeePictures: true });
  });

  it('honours an explicit choice, and reports nothing if that choice is not ready', () => {
    expect(pickFrom({ ...withOllama, hf: withHF.hf, connections: { ...withHF.connections, chatWith: 'huggingface' } }).kind).toBe('huggingface');
    expect(pickFrom({ ...withOllama, connections: { ...DEFAULT_CONNECTIONS, chatWith: 'local' } }).kind).toBeNull();
  });

  it('never uses online services in educator mode', () => {
    expect(pickFrom({ ...withHF, educatorMode: true }).kind).toBeNull();
    expect(pickFrom({ ...withOllama, educatorMode: true }).kind).toBe('private');
  });
});

describe('OpenAI-compatible replies', () => {
  it('reads streamed pieces and ignores the end marker', () => {
    const body = 'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\ndata: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n';
    expect([...parseSSE(body)].join('')).toBe('Hello');
  });

  it('pulls JSON out of a chatty reply', () => {
    expect(parseJSONReply<{ a: number }>('Sure! Here it is: {"a": 1} Enjoy.')).toEqual({ a: 1 });
    expect(() => parseJSONReply('no json here')).toThrow(/wrong shape/);
  });
});

import { isCloudModel } from '../src/ai/privateAI';

describe('Ollama cloud models', () => {
  const cloud = { ...base, privateAI: { online: true, models: ['gemma3:27b-cloud'], installed: [], chatModel: 'gemma3:27b-cloud', visionModel: 'gemma3:27b-cloud' } };

  it('recognises cloud model names', () => {
    expect(isCloudModel('gemma3:27b-cloud')).toBe(true);
    expect(isCloudModel('gpt-oss:120b-cloud')).toBe(true);
    expect(isCloudModel('glm-4.6:cloud')).toBe(true);
    expect(isCloudModel('gemma3:4b')).toBe(false);
    expect(isCloudModel('llama3.2')).toBe(false);
  });

  it('labels an Ollama cloud model as online, and keeps it out of educator mode', () => {
    expect(pickFrom(cloud)).toMatchObject({ kind: 'private', isPrivate: false, canSeePictures: true });
    expect(pickFrom({ ...cloud, educatorMode: true }).kind).toBeNull();
  });
});

import { afterEach, vi } from 'vitest';
import { chat, checkPrivateAI, OLLAMA_CLOUD, runsOnline } from '../src/ai/privateAI';
import { connectionReport } from '../src/ai/connections';

describe('Ollama’s servers, with an API key', () => {
  const tags = { models: [{ name: 'gpt-oss:120b' }, { name: 'gemma3:27b' }, { name: 'qwen3-vl:235b' }] };
  const calls: { url: string; auth?: string }[] = [];
  const serve = (answer: (url: string) => Response) =>
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
      calls.push({ url, auth: (init?.headers as Record<string, string> | undefined)?.Authorization });
      return answer(url);
    });
  const noOllamaApp = (url: string) => {
    if (!url.startsWith(OLLAMA_CLOUD)) throw new TypeError('connection refused');
    return Response.json(tags);
  };

  afterEach(() => {
    vi.unstubAllGlobals();
    calls.length = 0;
  });

  it('uses ollama.com when the Ollama app isn’t running, sending the key only there', async () => {
    serve(noOllamaApp);
    const status = await checkPrivateAI('', '', '', ' ollama_key ');
    expect(status).toMatchObject({ online: true, hosted: true, baseUrl: OLLAMA_CLOUD });
    expect(calls.map((c) => c.url)).toEqual(['/local/ai/api/tags', 'http://127.0.0.1:11434/api/tags', 'https://ollama.com/api/tags']);
    expect(calls.map((c) => c.auth)).toEqual([undefined, undefined, 'Bearer ollama_key']);
  });

  it('finds a Gemma cloud model chosen in the Ollama app by its name on ollama.com', async () => {
    serve(noOllamaApp);
    const status = await checkPrivateAI('gemma3:27b-cloud', '', 'gemma3:27b-cloud', 'k');
    expect(status.chatModel).toBe('gemma3:27b');
    expect(status.visionModel).toBe('gemma3:27b');
  });

  it('prefers the Ollama app on this computer, and never sends it the key', async () => {
    serve(() => Response.json({ models: [{ name: 'llama3.2' }] }));
    const status = await checkPrivateAI('', '', '', 'k');
    expect(status).toMatchObject({ online: true, chatModel: 'llama3.2' });
    expect(status.hosted).toBeFalsy();
    expect(calls.every((c) => !c.auth)).toBe(true);
  });

  it('only looks at ollama.com when there is a key', async () => {
    serve(noOllamaApp);
    expect((await checkPrivateAI()).online).toBe(false);
    expect(calls.some((c) => c.url.startsWith(OLLAMA_CLOUD))).toBe(false);
  });

  it('says so when the key is refused', async () => {
    serve((url) => (url.startsWith(OLLAMA_CLOUD) ? new Response('', { status: 401 }) : noOllamaApp(url)));
    expect(await checkPrivateAI('', '', '', 'wrong')).toMatchObject({ online: false, problem: 'Ollama didn’t accept that API key.' });
  });

  it('never sends the key to another server', async () => {
    serve(() => Response.json(tags));
    const status = await checkPrivateAI('', 'https://ollama.example.org', '', 'k');
    expect(status.hosted).toBe(true);
    expect(calls[0].auth).toBeUndefined();
  });

  it('chats with the key', async () => {
    serve(noOllamaApp);
    const status = await checkPrivateAI('gemma3:27b', '', '', 'k');
    serve(() => new Response('{"message":{"content":"Hi"}}\n{"message":{"content":" there"}}\n'));
    let out = '';
    for await (const piece of chat(status, [{ role: 'user', content: 'hello' }])) out += piece;
    expect(out).toBe('Hi there');
    expect(calls.at(-1)).toEqual({ url: 'https://ollama.com/api/chat', auth: 'Bearer k' });
  });

  it('labels every model on ollama.com as online, and keeps them out of private-only mode', () => {
    const hosted = { ...base, privateAI: { online: true, hosted: true, models: ['gemma3:27b'], installed: [], chatModel: 'gemma3:27b', visionModel: 'gemma3:27b' } };
    expect(runsOnline(hosted.privateAI, 'gemma3:27b')).toBe(true);
    expect(runsOnline({}, 'gemma3:27b')).toBe(false);
    expect(pickFrom(hosted)).toMatchObject({ kind: 'private', isPrivate: false, canSeePictures: true });
    expect(pickFrom({ ...hosted, educatorMode: true }).kind).toBeNull();
    const report = connectionReport({
      ...hosted,
      studio: { online: false },
      voice: { online: false, voices: [] },
      search: { searxng: false },
      settings: { educatorMode: false, classroom: false, teacherPin: '', storage: 'keep', theme: 'neon', connections: DEFAULT_CONNECTIONS },
    });
    expect(report.find((r) => r.id === 'chat')).toMatchObject({ ready: true, online: true, now: 'Using Ollama cloud (online)' });
  });
});
