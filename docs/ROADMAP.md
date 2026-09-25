# Roadmap

Each phase is judged by the one question: *does this help ordinary people understand how AI works?*

Status key: ✅ built · 🌱 first version built · ⏳ planned

---

## Phase 1: Foundation MVP ✅

**Goal:** prove that visual prompting is easier than traditional prompting.

| Feature | Status | Where |
| --- | --- | --- |
| Infinite canvas / whiteboard | ✅ | `src/canvas/Canvas.tsx` |
| Speech bubbles (Ideas), sticky Notes | ✅ | `src/canvas/CardView.tsx` |
| Picture uploads (click, drag and drop, paste) | ✅ | `CardView.tsx`, `Canvas.tsx` |
| Asset cards: Character, Style | ✅ | `src/model/cards.ts` |
| Visual links with plain-word meanings | ✅ | `src/canvas/Links.tsx` |
| Connections become instructions (recipe) | ✅ | `src/ai/recipe.ts` |
| AI assistant sidebar | ✅ | `src/ui/Sidebar.tsx` |
| Local project storage, board files | ✅ | `src/storage/projects.ts` |
| Local image generation | ✅ | `src/ai/imageEngine.ts` (local studio, or labelled sketch preview) |

The brief's user journey works as written: write "A hero explores a futuristic city", add a reference picture, connect them, press **Make a picture**, see the recipe, create, and the result appears on the board connected to its source.

**Next in Phase 1**
- Usability sessions with five complete beginners; measure time to first creation and run an explain-back test.
- Multi-select, copy/paste and grouping of cards.
- Keyboard-only connection flow (select a card, press C, choose the target) for accessibility.
- Right-to-left and translated UI strings.

## Phase 2: Producer AI 🌱

**Goal:** the board becomes intelligent.

Built:
- The Producer recognises project types (documentary, story, poster, video, lesson, presentation, or a general plan) and explains the steps and *why* each helps.
- "Place these on my board" lays the plan out as connected, empty cards with gentle hints.
- With the private assistant on, the Producer chats and can see a plain summary of the board. **"What your Producer can see"** shows that exact summary.

Next:
- Proactive but calm nudges ("Your hero appears in three scenes. Want a Character card so they look the same each time?"), always dismissible, never more than one at a time.
- The Producer can point at cards on the board while it talks.
- A plan library editable by educators and the community.

## Phase 3: Workflow tiles ⏳

**Goal:** expand beyond pictures. Every tile follows **Input → Process → Output**, shown in plain words on the tile itself.

Tiles: Image Generator, Video Generator, Audio, Voice, Research Assistant, Image Upscaler, Search, Script Writer, Storyboard Creator.

Design constraints, to avoid becoming a node editor:
- A tile is a card with one sentence ("Turns your *script* into a *voice recording*"), not a parameter panel.
- Connections still carry words. Tiles accept whatever is connected, and explain what they used.
- Every output card keeps "How this was made".
- Implementation: a `Tile` definition (`accepts`, `produces`, `explain()`, `run()`) that reuses the recipe builder for its inputs.

## Phase 4: AI education layer 🌱

**Goal:** teach AI concepts through doing.

Built: 12 discoveries (references, context, consistency, style, iteration, planning, how AI reads a description, picture-to-words, sketch vs. real). Each appears once at the moment it applies and is kept in **Discoveries**.

Next:
- "Try changing one thing" experiments: duplicate a creation, change one connection, compare side by side.
- Gentle critical-thinking prompts on results: "What did the AI get wrong? What on your board could fix it?"
- Discoveries on limits and responsibility: bias in outputs, why AI can be confidently wrong, consent for pictures of real people.

## Phase 5: Model manager ⏳

**Goal:** manage local AI seamlessly.

- Detect hardware, storage, memory and graphics capability (desktop build; the browser exposes too little).
- Recommend creative tools in friendly language: *"Your computer can comfortably run these creative tools."* Never *"You have 8 GB VRAM."*
- One-click install with progress in plain words, and a "what does this do?" card for each tool.

### Phase 5A: Smart storage ⏳

- Options: keep tools installed; tidy up automatically; remove unused tools when space is needed.
- **Never delete without permission.** Suggestions show what would be freed and how to get it back.

## Phase 6: Multi-modal creation ⏳

Idea → Research → Storyboard → Characters → Pictures → Video → Voice → Music → Final production, all on one board, all still explainable. Depends on Phase 3 tiles and Phase 5 tool management. Adds a timeline view that reads the board's "then" connections.

## Phase 7: Educator platform ⏳

**Goal:** the easiest way to teach AI literacy. Always a free path for education.

- Classroom boards: a teacher shares a starter board as a file; students open it locally (no accounts needed).
- "Show the process" export: a one-page summary of a student's board, recipes and iterations, for assessment of *process*, not just output.
- Lesson templates aligned to AI-literacy frameworks; offline-friendly for schools with limited internet.
- Educator mode that locks optional cloud features off.

## Phase 8: Visual AI operating system ⏳

Extend the same visual thinking to websites, presentations, lessons, research projects, business plans, marketing campaigns and simple applications. The board becomes a general AI problem-solving environment, where each output is still traceable back to the cards that shaped it.

---

## Technical milestones

1. **Desktop app** (Tauri): projects as real folders, native access to local AI, hardware detection for Phase 5.
2. **Plugin boundary** for AI adapters and tiles, so the community can add tools without touching the core.
3. **Optional, opt-in cloud**, clearly labelled, for people without capable hardware. Off by default and off in educator mode.
4. **Accessibility pass** to WCAG 2.2 AA: full keyboard use, screen-reader descriptions of boards and connections.
