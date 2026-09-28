/**
 * Moving connection settings between computers: a small JSON file made in
 * Admin. Access keys are left out unless the person asks for them.
 */

import { DEFAULT_CONNECTIONS, type Connections, type Settings } from './board';

const SECRETS: (keyof Connections)[] = ['hfToken', 'tavilyKey'];
const CHOICES: Partial<Record<keyof Connections, string[]>> = {
  chatWith: ['auto', 'private', 'local', 'huggingface', 'online'],
  picturesWith: ['auto', 'studio', 'huggingface'],
};

export function settingsFile(settings: Settings, includeKeys: boolean): string {
  const connections = { ...settings.connections };
  if (!includeKeys) for (const key of SECRETS) (connections[key] as string) = '';
  return JSON.stringify({ workshopSettings: 1, educatorMode: settings.educatorMode, connections }, null, 2);
}

/**
 * Reads a settings file. Only known settings of the right type are taken, and
 * an empty key in the file never wipes out a key already on this computer.
 */
export function readSettingsFile(text: string): { connections: Partial<Connections>; educatorMode?: boolean } {
  let data: { workshopSettings?: unknown; educatorMode?: unknown; connections?: Record<string, unknown> };
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
  return { connections, educatorMode: typeof data.educatorMode === 'boolean' ? data.educatorMode : undefined };
}
