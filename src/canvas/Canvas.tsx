import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { toBoard, useBoard } from '../store/board';
import { CardView } from './CardView';
import { LinkLabels, LinkLines } from './Links';
import { isImageFile, readImageFile } from './images';

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;

export function Canvas() {
  const cards = useBoard((s) => s.project.cards);
  const links = useBoard((s) => s.project.links);
  const viewport = useBoard((s) => s.project.viewport);
  const selectedId = useBoard((s) => s.selectedId);
  const { setViewport, select, addCard, addLink } = useBoard.getState();

  const root = useRef<HTMLDivElement>(null);
  const pan = useRef<{ px: number; py: number; x: number; y: number } | null>(null);
  const [linking, setLinking] = useState<{ fromId: string; to: { x: number; y: number } } | null>(null);
  const [dropping, setDropping] = useState(false);

  const local = useCallback((clientX: number, clientY: number) => {
    const r = root.current!.getBoundingClientRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }, []);

  // Scroll to move around; pinch or hold Ctrl/⌘ while scrolling to zoom.
  useEffect(() => {
    const el = root.current!;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('textarea, .popover')) return;
      e.preventDefault();
      const vp = useBoard.getState().project.viewport;
      if (e.ctrlKey || e.metaKey) {
        const p = local(e.clientX, e.clientY);
        const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * Math.exp(-e.deltaY * 0.01)));
        const k = zoom / vp.zoom;
        setViewport({ zoom, x: p.x - (p.x - vp.x) * k, y: p.y - (p.y - vp.y) * k });
      } else {
        setViewport({ ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [local, setViewport]);

  const connectFrom = useBoard((s) => s.connectFrom);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  const onBackgroundDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    // Two fingers on the board: pinch to zoom.
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: viewport.zoom };
      pan.current = null;
      return;
    }
    if (e.button !== 0) return;
    if (connectFrom) useBoard.getState().setConnectFrom(null);
    select(null);
    (document.activeElement as HTMLElement | null)?.blur?.();
    pan.current = { px: e.clientX, py: e.clientY, x: viewport.x, y: viewport.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const mid = local((a.x + b.x) / 2, (a.y + b.y) / 2);
      const vp = useBoard.getState().project.viewport;
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist)));
      const k = zoom / vp.zoom;
      setViewport({ zoom, x: mid.x - (mid.x - vp.x) * k, y: mid.y - (mid.y - vp.y) * k });
      return;
    }
    if (pan.current) {
      const p = pan.current;
      setViewport({ ...viewport, x: p.x + e.clientX - p.px, y: p.y + e.clientY - p.py });
    }
  };

  const startLink = useCallback(
    (fromId: string, e: ReactPointerEvent) => {
      const vp = useBoard.getState().project.viewport;
      setLinking({ fromId, to: toBoard(vp, local(e.clientX, e.clientY)) });
      const move = (ev: PointerEvent) => {
        const v = useBoard.getState().project.viewport;
        setLinking({ fromId, to: toBoard(v, local(ev.clientX, ev.clientY)) });
      };
      const up = (ev: PointerEvent) => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-card-id]');
        if (target?.dataset.cardId) addLink(fromId, target.dataset.cardId);
        setLinking(null);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    },
    [addLink, local],
  );

  const addPictures = (files: File[], at: { x: number; y: number }) => addPictureFiles(files, at, true);

  // Paste a picture straight onto the board.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if ((e.target as HTMLElement).closest?.('textarea, input')) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.some(isImageFile)) return;
      e.preventDefault();
      const r = root.current!.getBoundingClientRect();
      addPictures(files, toBoard(useBoard.getState().project.viewport, { x: r.width / 2, y: r.height / 2 }));
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const pendingFrom = linking && cards.find((c) => c.id === linking.fromId);

  return (
    <div
      ref={root}
      className={`canvas${dropping ? ' is-dropping' : ''}${linking || connectFrom ? ' is-linking' : ''}`}
      style={{
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
      }}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        pan.current = null;
        pointers.current.delete(e.pointerId);
        if (pointers.current.size < 2) pinch.current = null;
      }}
      onPointerCancel={(e) => {
        pointers.current.delete(e.pointerId);
        pinch.current = null;
      }}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget) return;
        addCard('idea', toBoard(viewport, local(e.clientX, e.clientY)), undefined, { exact: true });
        requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('.card.is-selected textarea')?.focus());
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          setDropping(true);
        }
      }}
      onDragLeave={() => setDropping(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropping(false);
        addPictures(Array.from(e.dataTransfer.files), toBoard(viewport, local(e.clientX, e.clientY)));
      }}
      aria-label="Your board"
    >
      <div className="world" style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}>
        <LinkLines cards={cards} links={links} pending={pendingFrom ? { from: pendingFrom, to: linking!.to } : undefined} />
        {cards.map((c) => (
          <CardView key={c.id} card={c} selected={c.id === selectedId} zoom={viewport.zoom} onStartLink={startLink} />
        ))}
        <LinkLabels cards={cards} links={links} />
      </div>
      {linking && <div className="canvas__hint">Let go on another card to connect them</div>}
      {connectFrom && <div className="canvas__hint">Now tap the card to connect to. Tap the empty board to cancel.</div>}
      {dropping && <div className="canvas__hint">Drop your picture anywhere</div>}
    </div>
  );
}

export function zoomBy(factor: number, size: { width: number; height: number }) {
  const { project, setViewport } = useBoard.getState();
  const vp = project.viewport;
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, vp.zoom * factor));
  const k = zoom / vp.zoom;
  const cx = size.width / 2;
  const cy = size.height / 2;
  setViewport({ zoom, x: cx - (cx - vp.x) * k, y: cy - (cy - vp.y) * k });
}

/** Space taken by floating panels (toolbar, checklist) along each edge of the board, so fitting avoids them. */
function reservedEdges(size: { width: number; height: number }) {
  const canvas = document.querySelector('.canvas')?.getBoundingClientRect();
  const edges = { left: 40, top: 40, right: 40, bottom: 40 };
  if (!canvas) return edges;
  for (const selector of ['.toolbar', '.getting-started', '.zoom']) {
    const r = document.querySelector(selector)?.getBoundingClientRect();
    if (!r) continue;
    const left = r.left - canvas.left;
    const top = r.top - canvas.top;
    // Reserve whichever edge the panel is nearest to.
    const gaps = { left: left, top: top, right: size.width - (left + r.width), bottom: size.height - (top + r.height) };
    const nearest = (Object.keys(gaps) as (keyof typeof gaps)[]).reduce((a, b) => (gaps[a] <= gaps[b] ? a : b));
    const depth = nearest === 'left' || nearest === 'right' ? r.width + gaps[nearest] : r.height + gaps[nearest];
    edges[nearest] = Math.max(edges[nearest], depth + 24);
  }
  return edges;
}

export function fitToCards(size: { width: number; height: number }) {
  const { project, setViewport } = useBoard.getState();
  if (!project.cards.length) return setViewport({ x: size.width / 2, y: size.height / 2, zoom: 1 });
  const minX = Math.min(...project.cards.map((c) => c.x));
  const minY = Math.min(...project.cards.map((c) => c.y));
  const maxX = Math.max(...project.cards.map((c) => c.x + c.w));
  const maxY = Math.max(...project.cards.map((c) => c.y + c.h));
  const e = reservedEdges(size);
  const areaW = Math.max(120, size.width - e.left - e.right);
  const areaH = Math.max(120, size.height - e.top - e.bottom);
  const zoom = Math.min(1.2, Math.max(MIN_ZOOM, Math.min(areaW / (maxX - minX), areaH / (maxY - minY))));
  setViewport({
    zoom,
    x: e.left + areaW / 2 - ((minX + maxX) / 2) * zoom,
    y: e.top + areaH / 2 - ((minY + maxY) / 2) * zoom,
  });
}

/** The board position currently in the middle of the screen. */
export function viewCenter() {
  const el = document.querySelector('.canvas');
  const r = el?.getBoundingClientRect() ?? { width: window.innerWidth, height: window.innerHeight };
  return toBoard(useBoard.getState().project.viewport, { x: r.width / 2, y: r.height / 2 });
}

export function canvasSize() {
  const r = document.querySelector('.canvas')?.getBoundingClientRect();
  return { width: r?.width ?? window.innerWidth, height: r?.height ?? window.innerHeight };
}

/** Gently moves the board so a spot is on screen, without changing the zoom. */
export function bringIntoView(r: { x: number; y: number; w: number; h: number }) {
  const { project, setViewport } = useBoard.getState();
  const vp = project.viewport;
  const { width, height } = canvasSize();
  const margin = 110;
  const left = r.x * vp.zoom + vp.x;
  const top = r.y * vp.zoom + vp.y;
  const right = left + r.w * vp.zoom;
  const bottom = top + r.h * vp.zoom;
  let dx = 0;
  let dy = 0;
  if (left < margin) dx = margin - left;
  else if (right > width - margin) dx = Math.max(margin - left, width - margin - right);
  if (top < margin / 2) dy = margin / 2 - top;
  else if (bottom > height - margin / 2) dy = Math.max(margin / 2 - top, height - margin / 2 - bottom);
  if (dx || dy) setViewport({ ...vp, x: vp.x + dx, y: vp.y + dy });
}

export function bringCardsIntoView(ids: string[]) {
  const cards = useBoard.getState().project.cards.filter((c) => ids.includes(c.id));
  if (!cards.length) return;
  const x = Math.min(...cards.map((c) => c.x));
  const y = Math.min(...cards.map((c) => c.y));
  bringIntoView({ x, y, w: Math.max(...cards.map((c) => c.x + c.w)) - x, h: Math.max(...cards.map((c) => c.y + c.h)) - y });
}

/** Adds pictures to the board. `exact` keeps them where they were dropped; otherwise they find free space nearby. */
export async function addPictureFiles(files: File[], at: { x: number; y: number }, exact = false) {
  const ids: string[] = [];
  let offset = 0;
  for (const file of files.filter(isImageFile)) {
    const { image, ratio } = await readImageFile(file);
    const w = 240;
    ids.push(
      useBoard.getState().addCard('picture', { x: at.x + offset, y: at.y + offset }, { image, w, h: Math.round(w * Math.min(ratio, 1.4)) + 64 }, { exact }),
    );
    offset += 30;
  }
  if (!exact) bringCardsIntoView(ids);
  return ids;
}
