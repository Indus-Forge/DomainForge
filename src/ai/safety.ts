/**
 * Classroom safety: a basic, honest layer for children using the Workshop at
 * school. It is not a guarantee, and says so in Admin.
 *  - Every assistant is told it is talking with a child and must keep things
 *    classroom-suitable.
 *  - Words sent to the AI (chat, picture descriptions, tool inputs) and words
 *    that come back are checked against a short list of topics that don't
 *    belong in a classroom, and for personal details like phone numbers.
 */

export const KID_RULES =
  'IMPORTANT: the person using this is a child at school, aged about 7 to 14. Keep everything suitable for a classroom: ' +
  'nothing violent beyond a gentle cartoon level, nothing scary, sexual, hateful or rude, and nothing about self-harm, ' +
  'drugs, alcohol, gambling or weapons. Never ask for personal details such as full names, addresses, schools or phone ' +
  'numbers. If asked for something unsuitable, kindly suggest a different, fun idea instead. Use simple words a child understands.';

// Whole words only, so "Essex" or "skill" never trip it. Words with everyday innocent uses (a shooting star,
// a bath bomb, blood cells, seaweed) are left out on purpose: the AI's own rules cover those.
const NOT_FOR_CLASS = new RegExp(
  '\\b(' +
    [
      'sex\\w*', 'sexy', 'porn\\w*', 'nude\\w*', 'naked', 'nsfw', 'boobs?', 'penis', 'vagina',
      'kill(s|ed|ing)?', 'murder\\w*', 'gore', 'gory', 'bloody', 'bloodbath', 'behead\\w*', 'torture\\w*', 'corpse\\w*',
      'suicid\\w*', 'self[- ]?harm', 'cutting myself',
      'guns?', 'rifles?', 'pistols?', 'grenades?', 'terroris\\w*',
      'drugs?', 'cocaine', 'heroin', 'cannabis', 'vape\\w*', 'beer', 'vodka', 'drunk', 'alcohol\\w*',
      'nazis?', 'hitler', 'racis\\w*', 'gambl\\w*', 'casino',
      'fuck\\w*', 'shit\\w*', 'bitch\\w*', 'bastard\\w*', 'wank\\w*', 'twat',
    ].join('|') +
    ')\\b',
  'i',
);

const PHONE = /(\+?\d[\d\s-]{8,}\d)/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.]+/;
const ADDRESS = /\b\d{1,4}\s+\w+\s+(street|st|road|rd|avenue|ave|lane|ln|drive|dr|close|way)\b/i;

export type SafetyProblem = 'topic' | 'personal';

/** Returns why this text doesn't belong in a classroom, or null when it's fine. */
export function classroomProblem(text: string): SafetyProblem | null {
  if (NOT_FOR_CLASS.test(text)) return 'topic';
  if (PHONE.test(text) || EMAIL.test(text) || ADDRESS.test(text)) return 'personal';
  return null;
}

export const SAFETY_MESSAGES: Record<SafetyProblem, string> = {
  topic: 'Let’s choose a different idea. That one isn’t right for school. How about something funny, magical or amazing instead?',
  personal: 'That looks like a personal detail, like a phone number, email or address. Keep those private: the AI doesn’t need them.',
};

/** Throws a friendly message when the text doesn't belong in a classroom. */
export function checkForClass(text: string) {
  const problem = classroomProblem(text);
  if (problem) throw new Error(SAFETY_MESSAGES[problem]);
}

/** Rewrites a message for children: sentences that send people to Admin point to the teacher instead. */
export function forClass(message: string, classroom: boolean): string {
  if (!classroom || !/\bAdmin\b/.test(message)) return message;
  const kept = message.split(/(?<=[.!?])\s+/).filter((sentence) => !/\bAdmin\b/.test(sentence));
  return [...kept, 'Ask your teacher for help.'].join(' ');
}
