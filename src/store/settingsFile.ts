/**
 * Moving connection settings between computers: a small JSON file made in
 * Admin. Access keys are left out unless the person asks for them.
 */

import { DEFAULT_CONNECTIONS, type Connections, type Settings } from './board';

const SECRETS: (keyof Connections)[] = ['ollamaKey', 'hfToken', 'tavilyKey'];
const CHOICES: Partial<Record<keyof Connections, string[]>> = {
  chatWith: ['auto', 'private', 'local', 'huggingface', 'online'],
  picturesWith: ['auto', 'studio', 'huggingface'],
};

export function settingsFile(settings: Settings, includeKeys: boolean): string {
  const connections = { ...settings.connections };
  if (!includeKeys) for (const key of SECRETS) (connections[key] as string) = '';
  return JSON.stringify(
    {
      workshopSettings: 1,
      educatorMode: settings.educatorMode,
      classroom: settings.classroom,
      // The PIN travels with the keys: both are for the teacher only.
      teacherPin: includeKeys ? settings.teacherPin : '',
      connections,
    },
    null,
    2,
  );
}

/**
 * Reads a settings file. Only known settings of the right type are taken, and
 * an empty key in the file never wipes out a key already on this computer.
 */
export function readSettingsFile(text: string): { connections: Partial<Connections>; other: Partial<Settings> } {
  let data: { workshopSettings?: unknown; educatorMode?: unknown; classroom?: unknown; teacherPin?: unknown; connections?: Record<string, unknown> };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file isn’t a Workshop settings file.');
  }
  if (data?.workshopSettings !== 1 || typeof data.connections !== 'object' || !data.connections) {
    throw new Error('That file isn’t a Workshop settings file.');
  }
  const connections: Partial<Connections> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_CONNECTIONS) as [keyof Connections, unknown][]) {
    const value = data.connections[key];
    if (typeof value !== typeof fallback) continue;
    if (SECRETS.includes(key) && !value) continue;
    if (CHOICES[key] && !CHOICES[key]!.includes(value as string)) continue;
    (connections as Record<string, unknown>)[key] = value;
  }
  const other: Partial<Settings> = {};
  if (typeof data.educatorMode === 'boolean') other.educatorMode = data.educatorMode;
  if (typeof data.classroom === 'boolean') other.classroom = data.classroom;
  if (typeof data.teacherPin === 'string' && /^\d{4,8}$/.test(data.teacherPin)) other.teacherPin = data.teacherPin;
  return { connections, other };
}
