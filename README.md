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

### The desktop app

The desktop app is the recommended way to use Workshop. It talks to AI on your computer directly, so no extra settings are needed, and it saves boards as real files wherever you choose.

```bash
npm install
npm run desktop          # run the desktop app while developing
npm run desktop:build    # build an installer for this computer
```

Building needs [Rust](https://rustup.rs) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system. Installers for macOS, Windows and Linux are built by the **Desktop app** workflow in GitHub Actions (run it by hand, or push a `v*` tag for a draft release).

### Switching on private AI (optional)

Everything runs on your own computer. Nothing is uploaded.

- **Personal AI Assistant**: install [Ollama](https://ollama.com), then `ollama pull llama3.2` (and `ollama pull llava` so it can describe pictures). This powers the Producer's chat, "Smooth the wording" and "Describe" on pictures.
- **Image studio**: run any local studio that offers the Stable Diffusion web API (for example AUTOMATIC1111 or Forge with `--api`) on port 7860.

Workshop finds them automatically. Open **Your AI** in the sidebar and press **Look again**. In the browser version, different addresses can be set with `WORKSHOP_PRIVATE_AI_URL` and `WORKSHOP_IMAGE_STUDIO_URL`. The desktop app looks at the standard addresses (`127.0.0.1:11434` and `127.0.0.1:7860`).

## What's in it

- **Infinite board**: scroll to move, pinch or Ctrl/⌘ + scroll to zoom, double-click to write an idea, drop or paste pictures.
- **Cards**: 💬 Idea, 🗒️ Note, 🖼️ Picture, 🧑‍🚀 Character, 🎨 Style, and ✨ Creations made by AI.
- **Connections with meanings in plain words** ("looks like", "in the style of", "features", "then"…). Click one to change what it means.
- **Recipe view**: before creating, see every card that will be used, why, and the exact words the AI will read.
- **How this was made**, on every creation, with a side-by-side **comparison with the previous version** and what changed.
- **Tools** 🧰: Picture Maker, Script Writer, Research Assistant, Storyboard Creator, Picture Enlarger and Voice. Connect cards to a tool and press Run.
- **The Producer**: tell it what you want to make and it lays out a plan on your board, explaining why each step helps.
- **Present** ▶: play the board as slides, optionally read aloud.
- **Discoveries**: 22 short explanations of how AI works, appearing when they're relevant.
- **Your AI**: private assistant and image studio status, an AI Model Library that recommends tools that fit your computer, smart storage that never deletes without asking, and **educator mode**.
- **Show the process**: a one-page summary of a board and how everything on it was made, for classrooms.
- Boards save automatically on your computer, and can be saved as files. Undo/redo throughout.

### Which AI does the work

1. **Private AI on your computer** (Ollama, and an image studio) always comes first.
2. **Online assistant**: only in the claude.ai preview, only when no private AI is found, and never in educator mode. It's labelled "online" wherever it's used. It can chat, write, describe pictures and draw simple illustrations.
3. **Nothing installed**: plans, storyboards, voice and labelled sketch previews still work.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app for development |
| `npm start` | Build, then serve the built app locally |
| `npm test` | Run unit tests |
| `npm run build` | Type-check and build to `dist/` |
| `npm run desktop` | Run the desktop app |
| `npm run desktop:build` | Build a desktop installer |

## Documents

- [Vision](docs/VISION.md): mission, principles, language guide, guardrails, success metrics
- [Architecture](docs/ARCHITECTURE.md): how the board becomes a recipe, AI adapters, storage
- [Roadmap](docs/ROADMAP.md): phases 1–8 and what's next

The repository's previous landing page is kept at `legacy/domainforge-landing.html`.
