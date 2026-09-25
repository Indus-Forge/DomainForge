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

## Phase 3: Workflow tiles 🌱

**Goal:** expand beyond pictures. Every tile follows **Input → Process → Output**, shown in plain words on the tile itself.

Built (`src/tools/`): **Picture Maker**, **Script Writer**, **Research Assistant**, **Storyboard Creator**, **Picture Enlarger** and **Voice**. Each tile's face says what it *takes*, what it *does* and what it *makes*, and lists what is connected to it. Results land on the board with a "made" connection and a "Made by…" caption.

- The Storyboard Creator works without any AI (one sentence per scene), and uses the assistant when one is on. Scenes come already connected to the characters and styles, so every scene picture stays consistent.
- The Picture Enlarger uses the image studio's AI upscaler when available and otherwise says plainly that it only stretched the picture.
- Voice uses the computer's built-in speech engine, on device.

Still to come: Video Generator, Music/Audio Generator, Search Tool (needs an opt-in internet permission).

Design constraints, to avoid becoming a node editor:
- A tile is a card with one sentence ("Turns your *script* into a *voice recording*"), not a parameter panel.
- Connections still carry words. Tiles accept whatever is connected, and explain what they used.
- Every output card keeps "How this was made".
- Implementation: a `Tile` definition (`accepts`, `produces`, `explain()`, `run()`) that reuses the recipe builder for its inputs.

## Phase 4: AI education layer 🌱

**Goal:** teach AI concepts through doing.

Built: **compare versions**. "How this was made" on any second or later version shows it side by side with the previous one, and lists exactly what changed on the board: cards added, removed or reworded. When nothing changed, it explains that AI rarely makes the same thing twice. Every recipe also carries a reflection prompt ("what did the AI get right, and what did it miss?").

22 discoveries, including where AI runs (online vs private), why AI research needs checking, how language AIs "draw" by writing code, stretching vs. AI upscaling, voice consent, and fair tests. The original 12 discoveries (references, context, consistency, style, iteration, planning, how AI reads a description, picture-to-words, sketch vs. real). Each appears once at the moment it applies and is kept in **Discoveries**.

Next:
- Discoveries on bias in outputs and consent for pictures of real people.
- A guided "change one thing" experiment that duplicates a board branch automatically.

## Phase 5: Model manager 🌱

**Goal:** manage local AI seamlessly.

Built: the **AI Model Library** in "Your AI". The desktop app measures memory, cores and free space where AI tools are kept (`computer_info` in `src-tauri/src/lib.rs`); the browser makes a rough guess. Six curated tools are marked "Runs comfortably", "Might be slow" or "Too big for this computer", and install with one click and live progress. Installed tools show their size and when they were last used.

Next: graphics card detection, and tools for the image studio (not only the assistant).

- Detect hardware, storage, memory and graphics capability (desktop build; the browser exposes too little).
- Recommend creative tools in friendly language: *"Your computer can comfortably run these creative tools."* Never *"You have 8 GB VRAM."*
- One-click install with progress in plain words, and a "what does this do?" card for each tool.

### Phase 5A: Smart storage 🌱

Built: a choice between **Keep everything installed** (default) and **Suggest tidying up**, which lists tools unused for a month, largest first, and notes when space is low. Each removal needs its own yes.


- Options: keep tools installed; tidy up automatically; remove unused tools when space is needed.
- **Never delete without permission.** Suggestions show what would be freed and how to get it back.

## Phase 6: Multi-modal creation 🌱

Built: a first complete pipeline, Idea → Script Writer → Storyboard Creator → a picture per scene → Voice → **Present**. Present mode plays the board as slides in "then" order, showing each scene's latest picture and optionally reading it aloud.


Idea → Research → Storyboard → Characters → Pictures → Video → Voice → Music → Final production, all on one board, all still explainable. Depends on Phase 3 tiles and Phase 5 tool management. Adds a timeline view that reads the board's "then" connections.

## Phase 7: Educator platform 🌱

Built: **Educator mode** ("keep everything on this computer": never uses online AI) and **Show the process**, a self-contained summary page of a board with every creation, its versions, the cards and words behind each, the whole board in words, and what the student discovered.


**Goal:** the easiest way to teach AI literacy. Always a free path for education.

- Classroom boards: a teacher shares a starter board as a file; students open it locally (no accounts needed).
- "Show the process" export: a one-page summary of a student's board, recipes and iterations, for assessment of *process*, not just output.
- Lesson templates aligned to AI-literacy frameworks; offline-friendly for schools with limited internet.
- Educator mode that locks optional cloud features off.

## Phase 8: Visual AI operating system 🌱

Started: Present mode turns any board into a presentation or lesson. Next: website, business-plan and marketing-campaign tiles that output documents instead of pictures.


Extend the same visual thinking to websites, presentations, lessons, research projects, business plans, marketing campaigns and simple applications. The board becomes a general AI problem-solving environment, where each output is still traceable back to the cards that shaped it.

---

## Technical milestones

1. 🌱 **Desktop app** (Tauri 2): built, with native access to local AI, board files saved through the system's save dialog, and installers from CI. Next: projects as real folders (`board.json` + `assets/`), hardware detection for Phase 5, signed and notarised installers, auto-update.
2. **Plugin boundary** for AI adapters and tiles, so the community can add tools without touching the core.
3. **Optional, opt-in cloud**, clearly labelled, for people without capable hardware. Off by default and off in educator mode.
4. **Accessibility pass** to WCAG 2.2 AA: full keyboard use, screen-reader descriptions of boards and connections.
