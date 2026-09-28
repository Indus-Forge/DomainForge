import { describe, expect, it } from 'vitest';
import { checkForClass, classroomProblem, forClass } from '../src/ai/safety';

describe('classroom safety', () => {
  it('lets ordinary school ideas through', () => {
    for (const ok of [
      'A dragon who is scared of the dark',
      'A shooting star over the sea',
      'How do red blood cells carry oxygen?',
      'A poster about Essex for our history project',
      'A bath bomb recipe with lavender',
      'Seaweed forests under the ocean',
      'My skills: football and drawing',
      'Moby Dick, the white whale',
      'The Battle of Hastings in 1066',
    ]) {
      expect(classroomProblem(ok), ok).toBeNull();
    }
  });

  it('stops topics that do not belong at school', () => {
    for (const bad of ['a picture of a gun', 'people getting killed', 'someone drinking beer', 'naked people', 'what the fuck']) {
      expect(classroomProblem(bad), bad).toBe('topic');
    }
  });

  it('stops personal details', () => {
    for (const bad of ['call me on 07700 900123', 'my email is sam@example.com', 'I live at 12 Park Road']) {
      expect(classroomProblem(bad), bad).toBe('personal');
    }
    expect(() => checkForClass('text me on +44 7700 900123')).toThrow(/personal detail/);
  });

  it('points children to their teacher instead of settings they cannot reach', () => {
    expect(forClass('Hugging Face didn’t accept your access token. Check it in Admin.', true)).toBe('Hugging Face didn’t accept your access token. Ask your teacher for help.');
    expect(forClass('Check it in Admin.', false)).toBe('Check it in Admin.');
    expect(forClass('Your video is ready.', true)).toBe('Your video is ready.');
  });
});
