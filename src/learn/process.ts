import type { Card, Project } from '../model/types';
import { CARD_INFO } from '../model/cards';
import { creationsFrom, describeBoard } from '../ai/recipe';
import { TIPS, type LearnEvent } from './tips';
import { saveTextFile } from '../platform';

/**
 * "Show the process": a single self-contained page summarising a board, every
 * creation, and exactly how each was made. Made for classrooms, where the
 * process matters as much as the result.
 */

const ROLE: Record<string, string> = {
  subject: 'Main idea',
  character: 'Character',
  detail: 'Detail',
  reference: 'Reference picture',
  style: 'Style',
};

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function safeImage(src: string | undefined): string {
  return src && /^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src) ? src : '';
}

function creationSection(creation: Card, version: number, total: number): string {
  const r = creation.recipe;
  if (!r) return '';
  const img = safeImage(creation.image);
  const ingredients = r.ingredients
    .map((i) => `<li><b>${esc(ROLE[i.role] ?? i.role)}:</b> ${esc(i.text || '(a picture)')}<br><small>${esc(i.why)}</small></li>`)
    .join('');
  return `<section class="creation">
    ${img ? `<img src="${img}" alt="">` : ''}
    <div>
      <h3>${total > 1 ? `Version ${version} of ${total}` : 'Creation'}${r.createdAt ? ` · ${esc(new Date(r.createdAt).toLocaleString())}` : ''}</h3>
      <p class="muted">Made with ${esc(r.madeWith ?? 'unknown')}</p>
      <h4>Cards that went in</h4><ul>${ingredients}</ul>
      <h4>What the AI read</h4><blockquote>${esc(r.sent ?? r.description)}</blockquote>
      ${r.sent && r.sent !== r.description ? `<p class="muted">Changed from the board’s words: “${esc(r.description)}”</p>` : ''}
    </div>
  </section>`;
}

export function processSummaryHtml(project: Project, discovered: LearnEvent[]): string {
  const starts = new Map<string, Card>();
  for (const c of project.cards) {
    if (c.kind === 'creation' && c.recipe) {
      const start = project.cards.find((s) => s.id === c.recipe!.startCardId);
      if (start) starts.set(start.id, start);
    }
  }
  const groups = [...starts.values()]
    .map((start) => {
      const versions = creationsFrom(project, start.id).filter((c) => c.recipe);
      const title = start.text || start.title || CARD_INFO[start.kind].name;
      return `<h2>${esc(CARD_INFO[start.kind].icon)} ${esc(title)}</h2>${versions.map((v, i) => creationSection(v, i + 1, versions.length)).join('')}`;
    })
    .join('');
  const learned = discovered.map((d) => `<li><b>${esc(TIPS[d].title)}.</b> ${esc(TIPS[d].body)}</li>`).join('');
  const counts = (Object.keys(CARD_INFO) as Card['kind'][])
    .map((k) => [k, project.cards.filter((c) => c.kind === k).length] as const)
    .filter(([, n]) => n)
    .map(([k, n]) => `${n} ${CARD_INFO[k].name.toLowerCase()}${n === 1 ? '' : 's'}`)
    .join(', ');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(project.name)} · the process</title>
<style>
body{font-family:system-ui,sans-serif;color:#2d2838;background:#f7f4ee;margin:0;padding:32px 16px;line-height:1.5}
main{max-width:860px;margin:0 auto}h1{margin:0 0 4px}.muted{color:#6b6478}
h2{margin-top:36px;border-bottom:2px solid #e7e0d4;padding-bottom:6px}
.creation{display:grid;grid-template-columns:minmax(0,300px) 1fr;gap:20px;background:#fffdf9;border:1px solid #e7e0d4;border-radius:16px;padding:16px;margin:16px 0}
.creation img{width:100%;border-radius:10px}.creation h3{margin:0}.creation h4{margin:12px 0 4px}
blockquote{margin:0;background:#eeebfb;border-radius:10px;padding:10px 12px}
pre{white-space:pre-wrap;background:#fffdf9;border:1px solid #e7e0d4;border-radius:12px;padding:12px;font-family:inherit}
@media (max-width:640px){.creation{grid-template-columns:1fr}}
</style></head><body><main>
<h1>${esc(project.name)}</h1>
<p class="muted">The process behind this board: ${esc(counts || 'an empty board')}. Saved ${esc(new Date().toLocaleString())} with Workshop.</p>
${groups || '<p>No creations yet.</p>'}
<h2>The whole board</h2><pre>${esc(describeBoard(project))}</pre>
${learned ? `<h2>What I learned about AI</h2><ul>${learned}</ul>` : ''}
</main></body></html>`;
}

export async function exportProcess(project: Project): Promise<boolean> {
  const { useBoard } = await import('../store/board');
  const html = processSummaryHtml(project, useBoard.getState().discovered);
  const name = `${project.name.replace(/[^\w\- ]+/g, '').trim() || 'board'} - process.html`;
  return saveTextFile(name, html);
}
