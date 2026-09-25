import { useEffect, useState } from 'react';
import { useBoard } from './store/board';
import { loadLastProject, newProject, saveProject } from './storage/projects';
import { Canvas, canvasSize } from './canvas/Canvas';
import { TopBar } from './ui/TopBar';
import { Toolbar, ZoomControls } from './ui/Toolbar';
import { Sidebar, type Tab } from './ui/Sidebar';
import { RecipePanel } from './ui/RecipePanel';
import { Toast } from './ui/Toast';
import { Welcome } from './ui/Welcome';
import { refreshAI } from './ui/YourAI';

export function App() {
  const [tab, setTab] = useState<Tab>('producer');

  // Open the last board, or start a fresh one centred on screen.
  useEffect(() => {
    loadLastProject().then((p) => {
      if (p) return useBoard.getState().setProject(p);
      const fresh = newProject();
      const { width, height } = canvasSize();
      fresh.viewport = { x: width / 2, y: height / 2, zoom: 1 };
      useBoard.getState().setProject(fresh);
      setTimeout(() => useBoard.getState().learn('welcome'), 800);
    });
  }, []);

  // Keep the board saved on this computer, quietly.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = async () => {
      clearTimeout(timer);
      timer = undefined;
      await saveProject(useBoard.getState().project);
      useBoard.getState().setSaveState('saved');
    };
    const unsubscribe = useBoard.subscribe((s, prev) => {
      if (!s.loaded || s.project === prev.project) return;
      if (s.saveState !== 'saving') s.setSaveState('saving');
      clearTimeout(timer);
      timer = setTimeout(flush, 400);
    });
    const onHide = () => timer && flush();
    window.addEventListener('pagehide', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      unsubscribe();
      window.removeEventListener('pagehide', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  // Notice when AI is switched on or off.
  useEffect(() => {
    refreshAI();
    window.addEventListener('focus', refreshAI);
    return () => window.removeEventListener('focus', refreshAI);
  }, []);

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement).closest('textarea, input');
      const { selectedId, deleteCard, undo, redo, openRecipe, recipeView, select } = useBoard.getState();
      if (e.key === 'Escape') {
        if (recipeView) openRecipe(null);
        else select(null);
        return;
      }
      if (typing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteCard(selectedId);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showTab = (t: Tab) => {
    setTab(t);
    useBoard.getState().toggleSidebar(true);
  };

  return (
    <div className="app">
      <TopBar onOpenAI={() => showTab('ai')} />
      <main className="stage">
        <Canvas />
        <Toolbar />
        <ZoomControls />
        <Welcome onAskProducer={() => {
          showTab('producer');
          requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.composer textarea')?.focus());
        }} />
        <Toast />
      </main>
      <Sidebar tab={tab} setTab={setTab} />
      <RecipePanel />
    </div>
  );
}
