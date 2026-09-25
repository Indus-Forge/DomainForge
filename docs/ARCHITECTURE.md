# Architecture

Workshop is a local-first web app (Vite, React, TypeScript). It runs in the browser today and is designed to be wrapped as a desktop app (Tauri is the intended path) without changing the core.

## Map

```
src/
  model/        What exists on a board
    types.ts      Card, Link, Board, Project, Recipe, Ingredient
    cards.ts      The card catalogue: friendly names, hints, sizes; link phrases
  ai/           Everything AI, behind plain-language interfaces
    recipe.ts     Board → Recipe. Pure, deterministic, tested. The heart of the product.
    privateAI.ts  Personal AI Assistant (Ollama today): status, chat, polish, describe picture
    imageEngine.ts  Picture making: local image studio, or the always-available sketch preview
    producer.ts   The Producer's plans (hand-written) and persona
    create.ts     Glue: place a creation card, make the picture, record how it was made
  learn/tips.ts Discoveries: short explanations tied to things people just did
  store/        App state (zustand): board, selection, undo/redo, AI status, discoveries
    layout.ts     Finding free space so new cards never cover people's work
  storage/      Local persistence (IndexedDB) and board files (.workshop.json)
  canvas/       Infinite board: pan, zoom, cards, connections, drag and drop, paste
  ui/           Top bar, toolbar, Producer sidebar, recipe panel, discoveries, "Your AI"
tests/          Unit tests for the recipe, the Producer and layout
docs/           Vision, architecture, roadmap
```

## The core idea in code: board → recipe

`buildRecipe(board, startCardId)` in `src/ai/recipe.ts`:

1. Starts from the card the person chose.
2. Follows connections in either direction, up to two steps away. Links marked `origin` (a creation pointing back to where it came from) are never followed, so old results don't leak into new ones unless the person connects them on purpose.
3. Gives every card a role from its kind: the start card is the **main idea**; characters are **characters**; pictures and creations are **reference pictures**; styles are **style**; other ideas and notes are **details**.
4. Writes a plain explanation for each ingredient ("You connected this picture with 'looks like', so it guides the look").
5. Composes the description in a fixed, readable order: main idea, characters, details, references (using the connection's words, e.g. "Looks like: …"), style.

It is deliberately deterministic and not "smart". The same board always makes the same recipe, so people can learn cause and effect. Optional AI help ("Smooth the wording") is shown **next to** the original, never silently substituted, and the recipe records which words were actually sent (`Recipe.sent`).

## AI adapters

The rest of the app talks to two small interfaces and never mentions vendors.

**Personal AI Assistant** (`privateAI.ts`):
- `checkPrivateAI()` finds a local runtime (currently Ollama's HTTP API), picks a chat model and, if present, a vision-capable model.
- `chat()` streams replies (used by the Producer). `polishDescription()` and `describePicture()` are single-purpose helpers with fixed, readable instructions.

**Picture making** (`imageEngine.ts`):
- `checkImageStudio()` finds any local server that speaks the common Stable Diffusion web API (AUTOMATIC1111, Forge and compatible tools).
- `makePicture()` uses text-to-image, or image-to-image when a reference picture is connected, so references genuinely guide the result.
- Without a studio, **sketch preview** draws a mood board from the recipe (colours from mood words, the reference pinned on, the description written in). It is labelled "Sketch" everywhere and explained by a discovery. It exists so people can learn the whole flow before installing anything.

Adding a new runtime (another local LLM server, a native Ollama image model, an optional cloud provider) means adding a branch inside one of these files. The UI does not change.

### Reaching local AI from the browser

The dev and preview servers proxy `/local/ai` → `127.0.0.1:11434` and `/local/images` → `127.0.0.1:7860` (override with `WORKSHOP_PRIVATE_AI_URL` / `WORKSHOP_IMAGE_STUDIO_URL`). This keeps requests same-origin, so people don't need to configure CORS. Each adapter also tries the direct address as a fallback. A desktop wrapper will make these calls from the native side.

## Storage

- Boards are stored in IndexedDB (`idb-keyval`) as whole `Project` documents, saved automatically ~0.4 s after changes and flushed when the page is hidden.
- Pictures are downscaled (max 1024 px) and stored inline as data URLs, which keeps a board a single portable file.
- "Save a copy as a file" writes `<name>.workshop.json`. "Open a board file" validates and imports it as a new board.
- Discoveries are remembered per browser in `localStorage`.

Future: a desktop build stores projects as folders (`board.json` plus an `assets/` directory) that people can see in their file manager, back up and share.

## Canvas

A custom canvas rather than a node-editor library, on purpose: the board must feel like a whiteboard, not a technical graph editor. There are no ports or typed sockets. Every card has one friendly "connect" dot, and every connection carries words.

- World transform: `translate(x, y) scale(zoom)` on one layer; the dot grid background tracks it.
- Scroll to pan, pinch or Ctrl/⌘ + scroll to zoom, drag the background to move around.
- Double-click the background for a new idea. Drop or paste pictures anywhere.
- Connection lines are SVG, clipped to card edges. Labels are HTML so they are clickable and accessible.
- Undo/redo keeps snapshots of cards and links (50 steps). Text edits checkpoint when a field gains focus.

## Testing

- `npm test` runs unit tests for the recipe builder, Producer plan matching and free-space layout.
- `npm run build` type-checks and bundles.
- The full flow (example → connect → recipe → create → "How this was made" → Producer plan → reload) was checked end to end in Chromium, with no AI running and with mock local AI services.
