import { describe, expect, it } from 'vitest';
import { findPlan, planReply } from '../src/ai/producer';

describe('findPlan', () => {
  it('recognises the documentary example from the brief', () => {
    const plan = findPlan('I want to create a documentary.');
    expect(plan?.id).toBe('documentary');
    expect(plan?.steps.map((s) => s.title)).toEqual(['The story', 'Research', 'References', 'Narration', 'Scenes']);
    // Every step after the main idea is connected to it, so it feeds the AI.
    expect(plan?.steps.slice(1).every((s) => s.link)).toBe(true);
    expect(plan?.steps.filter((s) => s.kind === 'tool').map((s) => s.tool)).toEqual(['research', 'script', 'storyboard']);
  });

  it('matches other kinds of project', () => {
    expect(findPlan('Can you help me make a comic about my cat?')?.id).toBe('story');
    expect(findPlan("I'd like to plan a lesson on volcanoes")?.id).toBe('lesson');
    expect(findPlan('I need to make a poster for the school fair')?.id).toBe('poster');
  });

  it('offers a general plan for projects it does not recognise', () => {
    expect(findPlan('I want to make something for my gran')?.id).toBe('general');
  });

  it('stays quiet when someone is just chatting', () => {
    expect(findPlan('What does a style card do?')).toBeUndefined();
    expect(findPlan('documentaries are great')).toBeUndefined();
  });

  it('explains why each step matters', () => {
    const reply = planReply(findPlan('I want to create a documentary')!);
    expect(reply).toContain('Good documentaries start with what is true.');
    expect(reply).toContain('place these on your board');
  });
});

import { findPictureRequest } from '../src/ai/producer';

describe('findPictureRequest', () => {
  it('pulls the subject out of everyday requests', () => {
    expect(findPictureRequest('make me a picture of a dog on the moon')).toBe('a dog on the moon');
    expect(findPictureRequest('Can you draw a castle in the clouds please?')).toBe('a castle in the clouds');
    expect(findPictureRequest('I want an image of my cat as a pirate')).toBe('my cat as a pirate');
  });

  it('ignores messages that are not asking for a picture', () => {
    expect(findPictureRequest('I want to make a documentary about bees')).toBeUndefined();
    expect(findPictureRequest('can you draw it please')).toBeUndefined();
    expect(findPictureRequest('what is a style card?')).toBeUndefined();
  });
});
