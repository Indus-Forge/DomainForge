/**
 * The few places where the desktop app and the browser behave differently.
 *
 * In the desktop app, requests to AI on this computer are made natively, so
 * nobody has to configure their AI tools to trust a web page. In the browser,
 * the dev server forwards them instead.
 */

export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

let nativeFetch: typeof fetch | undefined;

/** fetch() for talking to AI running on this computer. */
export async function localFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!isDesktop) return fetch(url, init);
  nativeFetch ??= (await import('@tauri-apps/plugin-http')).fetch;
  return nativeFetch(url, init);
}

/** Where to look for a local service: through the dev server's forwarding in the browser, directly on the desktop. */
export function placesToLook(forwarded: string, direct: string): string[] {
  return isDesktop ? [direct] : [forwarded, direct];
}

/** Asks a yes/no question with the operating system's own dialog on the desktop. */
export async function askToConfirm(message: string): Promise<boolean> {
  if (!isDesktop) return window.confirm(message);
  const { ask } = await import('@tauri-apps/plugin-dialog');
  return ask(message, { title: 'Workshop', kind: 'warning' });
}

/** Saves text to a file the person chooses. Returns false if they cancel. */
export async function saveTextFile(suggestedName: string, text: string): Promise<boolean> {
  if (isDesktop) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const path = await save({ defaultPath: suggestedName, filters: [{ name: 'Workshop board', extensions: ['json'] }] });
    if (!path) return false;
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    await writeTextFile(path, text);
    return true;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = suggestedName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}
