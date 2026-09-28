/**
 * Finding out why Workshop can't be seen on a computer. A few seconds after
 * it starts, it checks whether its top bar is really on screen, and if not,
 * what covers or hides it. In development the report is printed in the
 * terminal running `npm run dev`, which works even when the page shows
 * nothing at all. Add ?debug to the address to always get the full report,
 * on the page as well. Nothing is sent anywhere else, and access keys and
 * the teacher's PIN are never included.
 */

import { isDesktop } from './platform';

const errors: string[] = [];

function describe(el: Element | null): string {
  if (!el) return 'nothing';
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const classes = typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '';
  return (
    `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${classes} ` +
    `[at ${Math.round(r.x)},${Math.round(r.y)} size ${Math.round(r.width)}×${Math.round(r.height)} z-index ${cs.zIndex} background ${cs.backgroundColor} opacity ${cs.opacity}]`
  );
}

/** Anything between an element and the page that could hide it. */
function hiders(el: Element | null): string[] {
  const out: string[] = [];
  for (let e = el; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    const odd = [
      cs.display === 'none' && 'display: none',
      cs.visibility !== 'visible' && `visibility: ${cs.visibility}`,
      Number(cs.opacity) < 0.1 && `opacity: ${cs.opacity}`,
      cs.transform !== 'none' && `transform: ${cs.transform}`,
      cs.filter !== 'none' && `filter: ${cs.filter}`,
      cs.clipPath !== 'none' && `clip-path: ${cs.clipPath}`,
      !['', 'visible'].includes(cs.getPropertyValue('content-visibility')) && `content-visibility: ${cs.getPropertyValue('content-visibility')}`,
      !['', '1', 'normal'].includes(cs.getPropertyValue('zoom')) && `zoom: ${cs.getPropertyValue('zoom')}`,
    ].filter(Boolean);
    if (odd.length) out.push(`${describe(e)} ${odd.join(', ')}`);
  }
  return out;
}

function settingsSummary(): string {
  try {
    const s = JSON.parse(localStorage.getItem('workshop:settings') ?? '{}');
    return JSON.stringify({ theme: s.theme, classroom: s.classroom, privateOnly: s.educatorMode });
  } catch {
    return 'unreadable';
  }
}

/** How many frames the page drew, and how often the page changed, in one second. */
function measure(): Promise<{ frames: number; changes: number }> {
  return new Promise((resolve) => {
    let frames = 0;
    let changes = 0;
    const watcher = new MutationObserver((list) => (changes += list.length));
    watcher.observe(document.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const tick = () => {
      frames++;
      requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    setTimeout(() => {
      cancelAnimationFrame(id);
      watcher.disconnect();
      resolve({ frames, changes });
    }, 1000);
  });
}

async function report(): Promise<{ seen: boolean; text: string }> {
  const bar = document.querySelector('.topbar');
  const r = bar?.getBoundingClientRect();
  const probe = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
  const seen = Boolean(bar && r && r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && probe && bar.contains(probe));
  const { frames, changes } = await measure();
  const lines = [
    `Workshop screen check: ${seen ? 'the top bar is on screen and nothing covers it' : 'THE TOP BAR CANNOT BE SEEN'}`,
    `page: ${location.href} (tab ${document.visibilityState})`,
    `window: ${innerWidth}×${innerHeight} at ${devicePixelRatio}× · scrolled to ${Math.round(scrollX)},${Math.round(scrollY)} · page size ${document.documentElement.scrollWidth}×${document.documentElement.scrollHeight}`,
    `app parts on the page: ${document.getElementById('root')?.childElementCount ?? 'no root'} · top bar: ${bar ? describe(bar) : 'missing'}`,
    `at the top bar's middle: ${describe(probe)}`,
    `at the centre of the window: ${describe(document.elementFromPoint(innerWidth / 2, innerHeight / 2))}`,
    ...hiders(bar).map((h) => `could hide the top bar: ${h}`),
    `drawing: ${frames} frames in one second · ${changes} page changes in that second · ${document.getAnimations().length} animations running`,
    `fonts ${document.fonts.status} · ${document.styleSheets.length} stylesheets · reduced motion ${matchMedia('(prefers-reduced-motion: reduce)').matches} · forced colours ${matchMedia('(forced-colors: active)').matches}`,
    `settings: ${settingsSummary()}`,
    `browser: ${navigator.userAgent}`,
    ...(errors.length ? errors.map((e) => `error: ${e}`) : ['errors: none caught']),
  ];
  return { seen, text: lines.join('\n') };
}

function showOnPage(text: string) {
  const box = document.createElement('div');
  box.setAttribute('role', 'alert');
  box.style.cssText =
    'position:fixed;inset:12px 12px auto;z-index:2147483647;max-height:80vh;overflow:auto;background:#fff;color:#111;' +
    'font:12px/1.5 ui-monospace,Consolas,monospace;padding:12px 14px;border:3px solid #d11;border-radius:8px;white-space:pre-wrap';
  box.textContent = `${text}\n\nSelect this text and copy it, or copy it from the window running npm run dev. Click here to close.`;
  box.addEventListener('click', () => window.getSelection()?.isCollapsed && box.remove());
  document.body.append(box);
}

function sendToTerminal(text: string) {
  if (isDesktop || !['localhost', '127.0.0.1'].includes(location.hostname)) return;
  fetch('/local/diagnose', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: text }).catch(() => undefined);
}

export function watchScreen() {
  window.addEventListener('error', (e) => errors.push(`${e.message}${e.filename ? ` (${e.filename}:${e.lineno})` : ''}`));
  window.addEventListener('unhandledrejection', (e) => errors.push(`unhandled: ${e.reason?.stack ?? e.reason}`));
  const always = new URLSearchParams(location.search).has('debug');
  setTimeout(async () => {
    const { seen, text } = await report();
    if (seen && !always) {
      sendToTerminal(text.split('\n')[0] + ' (add ?debug to the address for the full report)');
      return;
    }
    sendToTerminal(text);
    showOnPage(text);
    if (!seen) document.title = 'Workshop: screen problem found';
  }, 4000);
}
