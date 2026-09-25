import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../store/board';
import { exportProject, importProject, listProjects, loadProject, newProject, deleteProject, type ProjectSummary } from '../storage/projects';

export function TopBar({ onOpenAI }: { onOpenAI(): void }) {
  const name = useBoard((s) => s.project.name);
  const saveState = useBoard((s) => s.saveState);
  const privateAI = useBoard((s) => s.privateAI);
  const canUndo = useBoard((s) => s.past.length > 0);
  const canRedo = useBoard((s) => s.future.length > 0);
  const sidebarOpen = useBoard((s) => s.sidebarOpen);
  const { renameProject, undo, redo, toggleSidebar } = useBoard.getState();

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden>
          🪴
        </span>
        <span className="brand__name">Workshop</span>
      </div>
      <ProjectsMenu />
      <input className="project-name" value={name} onChange={(e) => renameProject(e.target.value)} aria-label="Board name" />
      <span className="saved" aria-live="polite">
        {saveState === 'saving' ? 'Saving…' : '✓ Saved on this computer'}
      </span>

      <div className="topbar__spacer" />

      <button className="icon-button" onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" aria-label="Undo">
        ↶
      </button>
      <button className="icon-button" onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)" aria-label="Redo">
        ↷
      </button>
      <button className={`status-pill ${privateAI.online ? 'is-on' : ''}`} onClick={onOpenAI}>
        {privateAI.online ? '🟢 Private AI ready' : '⚪ Private AI off'}
      </button>
      <button className="icon-button" onClick={() => toggleSidebar()} aria-pressed={sidebarOpen} title="Show or hide the Producer">
        {sidebarOpen ? '⇥' : '⇤'}
      </button>
    </header>
  );
}

function ProjectsMenu() {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [problem, setProblem] = useState('');
  const current = useBoard((s) => s.project);
  const file = useRef<HTMLInputElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listProjects().then(setProjects);
    const away = (e: PointerEvent) => !menu.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', away);
    return () => window.removeEventListener('pointerdown', away);
  }, [open]);

  const switchTo = (p: Parameters<ReturnType<typeof useBoard.getState>['setProject']>[0]) => {
    useBoard.getState().setProject(p);
    setOpen(false);
  };

  return (
    <div className="menu" ref={menu}>
      <button className="button button--quiet button--small" onClick={() => setOpen(!open)} aria-expanded={open}>
        Boards ▾
      </button>
      {open && (
        <div className="menu__list" role="menu">
          <button role="menuitem" onClick={() => switchTo(newProject('Untitled board'))}>
            ＋ New board
          </button>
          <button role="menuitem" onClick={() => exportProject(current)}>
            💾 Save a copy as a file
          </button>
          <button role="menuitem" onClick={() => file.current?.click()}>
            📂 Open a board file
          </button>
          <input
            ref={file}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                switchTo(await importProject(f));
              } catch (err) {
                setProblem((err as Error).message);
              }
              e.target.value = '';
            }}
          />
          {problem && <p className="problem">{problem}</p>}
          {projects.length > 0 && <p className="menu__heading">Your boards on this computer</p>}
          {projects.map((p) => (
            <div key={p.id} className={`menu__project${p.id === current.id ? ' is-current' : ''}`}>
              <button
                role="menuitem"
                onClick={async () => {
                  const loaded = await loadProject(p.id);
                  if (loaded) switchTo(loaded);
                }}
              >
                {p.name || 'Untitled board'}
                <small>{new Date(p.updatedAt).toLocaleDateString()}</small>
              </button>
              {p.id !== current.id && (
                <button
                  className="menu__remove"
                  title="Remove this board from your computer"
                  aria-label={`Remove ${p.name}`}
                  onClick={async () => {
                    if (!confirm(`Remove “${p.name}” from this computer? This can’t be undone.`)) return;
                    await deleteProject(p.id);
                    setProjects(await listProjects());
                  }}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
