import { beforeEach, describe, expect, it } from 'vitest';
import { choosePictureMaker } from '../src/ai/create';
import { DEFAULT_CONNECTIONS, useBoard } from '../src/store/board';

const connect = (patch: { studio?: boolean; hf?: boolean; educator?: boolean; route?: 'auto' | 'studio' | 'huggingface' }) =>
  useBoard.setState((s) => ({
    studio: patch.studio ? { online: true, baseUrl: 'http://127.0.0.1:7860' } : { online: false },
    hf: patch.hf ? { connected: true, name: 'me' } : { connected: false },
    settings: {
      ...s.settings,
      educatorMode: Boolean(patch.educator),
      connections: { ...DEFAULT_CONNECTIONS, hfToken: patch.hf ? 'hf_x' : '', picturesWith: patch.route ?? 'auto' },
    },
  }));

describe('choosing a picture maker', () => {
  beforeEach(() => connect({}));

  it('makes no picture at all when no real picture model is connected', () => {
    expect(choosePictureMaker()).toBeNull();
  });

  it('prefers the image studio on this computer, then Hugging Face', () => {
    connect({ studio: true, hf: true });
    expect(choosePictureMaker()).toBe('studio');
    connect({ hf: true });
    expect(choosePictureMaker()).toBe('huggingface');
  });

  it('honours the AI Hub choice when it is ready', () => {
    connect({ studio: true, hf: true, route: 'huggingface' });
    expect(choosePictureMaker()).toBe('huggingface');
  });

  it('never sends pictures online in educator mode', () => {
    connect({ hf: true, educator: true });
    expect(choosePictureMaker()).toBeNull();
  });
});
