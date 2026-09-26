import { describe, expect, it } from 'vitest';
import { pickFrom, spiceIsPrivate, type AISources } from '../src/ai/assistant';
import { parseSSE, parseJSONReply } from '../src/ai/openaiCompat';
import { DEFAULT_CONNECTIONS } from '../src/store/board';

const base: AISources = {
  privateAI: { online: false, models: [], installed: [] },
  onlineAI: { available: false, canSeePictures: false },
  localAI: { online: false, models: [] },
  spiceAI: { online: false, models: [] },
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

describe('Spice.ai', () => {
  const spice = (model: string) => ({
    ...base,
    spiceAI: { online: true, models: ['local-ollama-chat', 'hf-qwen-chat'] },
    connections: { ...DEFAULT_CONNECTIONS, spiceModel: model },
  });

  it('treats local- models as private and hf- models as online', () => {
    expect(spiceIsPrivate('local-ollama-chat')).toBe(true);
    expect(spiceIsPrivate('hf-qwen-chat')).toBe(false);
    expect(pickFrom(spice('local-ollama-chat'))).toMatchObject({ kind: 'spice', isPrivate: true });
    expect(pickFrom(spice('hf-qwen-chat'))).toMatchObject({ kind: 'spice', isPrivate: false });
  });

  it('keeps online Spice models out of educator mode, but not private ones', () => {
    expect(pickFrom({ ...spice('hf-qwen-chat'), educatorMode: true }).kind).toBeNull();
    expect(pickFrom({ ...spice('local-ollama-chat'), educatorMode: true }).kind).toBe('spice');
  });

  it('puts a private Spice model ahead of a local server, and an online one after it', () => {
    const both = (model: string) => ({ ...spice(model), localAI: withLocal.localAI, connections: { ...withLocal.connections, spiceModel: model } });
    expect(pickFrom(both('local-ollama-chat')).kind).toBe('spice');
    expect(pickFrom(both('hf-qwen-chat')).kind).toBe('local');
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
