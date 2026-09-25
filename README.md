# Workshop

**Learn AI by building.** A visual workspace that teaches people how AI works, through making things.

Put ideas, notes, pictures, characters and styles on an infinite board. Connect them. Your connections become the instructions, and Workshop always shows you exactly how your board was turned into words the AI reads.

*Your AI. Your computer. Your ideas.*

## Try it

```bash
npm install
npm run dev        # open http://localhost:5173
```

Then press **Try an example**, follow the note on the board, and press **✨ Make a picture**.

You don't need any AI installed to start. Without it, pictures are shown as clearly labelled **sketch previews**, so you can learn the whole process first.

### Switching on private AI (optional)

Everything runs on your own computer. Nothing is uploaded.

- **Personal AI Assistant**: install [Ollama](https://ollama.com), then `ollama pull llama3.2` (and `ollama pull llava` so it can describe pictures). This powers the Producer's chat, "Smooth the wording" and "Describe" on pictures.
- **Image studio**: run any local studio that offers the Stable Diffusion web API (for example AUTOMATIC1111 or Forge with `--api`) on port 7860.

Workshop finds them automatically. Open **Your AI** in the sidebar and press **Look again**. Different addresses can be set with `WORKSHOP_PRIVATE_AI_URL` and `WORKSHOP_IMAGE_STUDIO_URL`.

## What's in the first version

- Infinite board: scroll to move, pinch or Ctrl/⌘ + scroll to zoom, double-click to write an idea, drop or paste pictures.
- Cards: 💬 Idea, 🗒️ Note, 🖼️ Picture, 🧑‍🚀 Character, 🎨 Style, and ✨ Creations made by AI.
- Connections with meanings in plain words ("looks like", "in the style of", "features", …). Click a connection to change what it means.
- **Recipe view**: before creating, see every card that will be used, why, and the exact words the AI will read. You can keep the board's words, ask the assistant to smooth them, or write your own.
- **How this was made**: on every creation, forever.
- **The Producer**: tell it what you want to make ("I want to create a documentary") and it lays out a plan on your board, explaining why each step helps.
- **Discoveries**: short explanations of how AI works, appearing at the moment they're relevant.
- Boards save automatically on your computer. Save a copy as a file and open it again anywhere. Undo/redo throughout.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app for development |
| `npm start` | Build, then serve the built app locally |
| `npm test` | Run unit tests |
| `npm run build` | Type-check and build to `dist/` |

## Documents

- [Vision](docs/VISION.md): mission, principles, language guide, guardrails, success metrics
- [Architecture](docs/ARCHITECTURE.md): how the board becomes a recipe, AI adapters, storage
- [Roadmap](docs/ROADMAP.md): phases 1–8 and what's next

The repository's previous landing page is kept at `legacy/domainforge-landing.html`.
