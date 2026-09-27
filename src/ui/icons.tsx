import type { LucideIcon } from 'lucide-react';
import {
  Clapperboard,
  Film,
  Image as ImageIcon,
  Maximize2,
  MessageSquareText,
  Mic,
  Palette,
  ScrollText,
  Search,
  Sparkles,
  StickyNote,
  UserRound,
  Wand2,
  Wrench,
} from 'lucide-react';
import type { CardKind, ToolId } from '../model/types';

/** One icon per kind of card, used everywhere the kind appears. */
export const KIND_ICON: Record<CardKind, LucideIcon> = {
  idea: MessageSquareText,
  note: StickyNote,
  picture: ImageIcon,
  character: UserRound,
  style: Palette,
  creation: Sparkles,
  tool: Wrench,
  video: Film,
};

export const TOOL_ICON: Record<ToolId, LucideIcon> = {
  image: Wand2,
  video: Clapperboard,
  script: ScrollText,
  research: Search,
  storyboard: Film,
  enlarge: Maximize2,
  voice: Mic,
};

/** A small coloured badge showing a card kind's icon. Colour comes from the kind's theme token. */
export function KindBadge({ kind, size = 14 }: { kind: CardKind; size?: number }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className={`kind-badge kind-badge--${kind}`} aria-hidden>
      <Icon size={size} strokeWidth={2} />
    </span>
  );
}
