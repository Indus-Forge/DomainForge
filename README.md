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

Pictures only ever come from a real image model: **Hugging Face** (a free token, set up in Admin in about a minute) or an **image studio** on your computer. With no picture model connected, the app makes no picture at all: it shows you the recipe the model would read and points you to Admin. It never draws a stand-in.

### The desktop app

The desktop app is the recommended way to use Workshop. It talks to AI on your computer directly, so no extra settings are needed, and it saves boards as real files wherever you choose.

```bash
npm install
npm run desktop          # run the desktop app while developing
npm run desktop:build    # build an installer for this computer
```

Building needs [Rust](https://rustup.rs) and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your system. Installers for macOS, Windows and Linux are built by the **Desktop app** workflow in GitHub Actions (push a `v*` tag for a draft release; running it by hand from the Actions tab works once the workflow is on the default branch).

**Windows from Linux.** A test installer can be cross-built without a Windows machine (NSIS only, unsigned):

```bash
rustup target add x86_64-pc-windows-gnu
sudo apt install mingw-w64 nsis
# The mobile-only cdylib has too many exports for MinGW's linker, so leave it out of this build.
sed -i 's/"staticlib", "cdylib", "rlib"/"rlib"/' src-tauri/Cargo.toml
npx tauri build --target x86_64-pc-windows-gnu --bundles nsis
git checkout src-tauri/Cargo.toml
```

The installer is written to `src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/`. Release builds should still come from the workflow (MSVC, MSI and NSIS).

### In a classroom

Set it up once, then children only see what they need:

1. Open **Admin** and connect a picture model (a free Hugging Face token) and, if you like, Ollama for the Producer.
2. Under **Classroom & privacy**, switch on **Classroom mode** and set a **teacher PIN**.
3. To set up more computers, use **Export settings** (tick the box to include keys and the PIN) and **Import settings** on each one.

In classroom mode:
- Admin is behind a small lock in the top bar and asks for the PIN.
- The "Your AI" tab only says, in plain words, what the AI can do.
- Anything a child would need to fix says "Ask your teacher" instead.
- An empty board asks **"What shall we make today?"**: a story, a comic, a poster, a video or a fact file. The choice lays out a plan, and the Producer says what to do first.
- The getting-started guide stays on and makes the next button glow.
- Every AI is told it's talking with a child at school. Words going to and from the AI are checked for topics that don't belong in a classroom and for personal details like phone numbers. It's a helpful layer, not a guarantee.

**Private only** (in the same section) is separate: it switches off every online service. Pictures then need an image studio on the computer.

### Connecting everything: Admin

Press **Admin** in the top bar (the counter next to it shows how many of the six AI capabilities are connected). At the top, Admin lists each capability (chat and writing, reading pictures, making pictures, AI voice, web research, AI enlarging) with what powers it now, or exactly what it needs, and a **Connect** button that jumps to the entry. Below are the entries for every connection, then which AI does what (chat, pictures). **Auto** always uses private AI first.

| Connection | Where it runs | What it gives you | How to connect |
| --- | --- | --- | --- |
| **Ollama** | Private, on your computer (cloud models: online) | Chat, writing, reading pictures (with `qwen2.5vl` or Gemma 3), AI-directed video edits | Install [Ollama](https://ollama.com) and open it. Add models from the hub by name or from the Model Library, and choose which one chats and which reads pictures. **Cloud models** (e.g. Gemma cloud) run on Ollama's servers and are labelled online. Either run `ollama signin` once and add the model by name (e.g. `gemma3:27b-cloud`), or, with nothing installed, paste an **API key** from ollama.com → Settings → Keys into Admin and pick the model (e.g. `gemma3:27b`). The Ollama app is always used first when it's running; the key is only ever sent to ollama.com. |
| **Local model server** | Private, on your computer | Chat and writing with any model you run | Any OpenAI-compatible address, e.g. LM Studio `http://127.0.0.1:1234/v1`, llama.cpp, Jan, vLLM |
| **Hugging Face** | Online | **Real pictures** (FLUX, Stable Diffusion) plus Qwen chat and picture reading, nothing to install | Paste a free access token from huggingface.co → Settings → Access Tokens (allow “Make calls to Inference Providers”) |
| **Image studio** | Private, on your computer | Real pictures offline, and AI enlarging | Forge or AUTOMATIC1111 started with `--api` (needs a graphics card) |
| **AI voice** | Private, on your computer | The Voice tool reads with a natural AI voice and keeps a recording you can save | Any OpenAI-style speech server, e.g. [Kokoro-FastAPI](https://github.com/remsky/Kokoro-FastAPI): `docker run -d -p 8880:8880 ghcr.io/remsky/kokoro-fastapi-cpu:latest`. Found automatically on `127.0.0.1:8880`. |
| **SearXNG web search** | Your own server (asks public search engines) | The Research tool searches the web and cites real sources | `docker run -d -p 8080:8080 searxng/searxng`, add `json` under `search: formats:` in its `settings.yml`, enter `http://127.0.0.1:8080` |
| **Tavily web search** | Online | The same, without installing anything | Paste a free key from tavily.com |

Online services are labelled everywhere they're used, and **private-only mode** switches all of them off. Tokens and settings are stored only on your computer. **Export settings** in Admin saves them to a file (access keys only if you tick the box) so you can **Import settings** on another computer.

In the browser version, every service on your computer is reached through the dev server (`npm run dev`), so nothing needs CORS settings. The desktop app reaches them directly.

Without an AI voice, the Voice tool uses the computer's built-in voice and says so. Without web search, research notes come from the assistant's memory and say they weren't searched.

## What's in it

- **Infinite board**: scroll to move, pinch or Ctrl/⌘ + scroll to zoom, double-click to write an idea, drop or paste pictures.
- **Cards**: 💬 Idea, 🗒️ Note, 🖼️ Picture, 🧑‍🚀 Character, 🎨 Style, and ✨ Creations made by AI.
- **Connections with meanings in plain words** ("looks like", "in the style of", "features", "then"…). Click one to change what it means.
- **Recipe view**: before creating, see every card that will be used, why, and the exact words the AI will read.
- **How this was made**, on every creation, with a side-by-side **comparison with the previous version** and what changed.
- **Tools** 🧰: Picture Maker, Video Maker, Script Writer, Research Assistant (web search with sources), Storyboard Creator, Picture Enlarger and Voice (AI voice with a saved recording). Connect cards to a tool and press Run.
- **The Producer**: tell it what you want to make and it lays out a plan on your board, explaining why each step helps. It's an animated character: it waves hello, leans in while you type, puts a hand to its chin while the AI thinks, talks as the reply arrives, and grins (or looks worried) at the end. Its eyes follow your pointer; click it to say hello.
- **Present** ▶: play the board as slides, optionally read aloud.
- **Discoveries**: 21 short explanations of how AI works, appearing when they're relevant.
- **Your AI**: private assistant and image studio status, an AI Model Library that recommends tools that fit your computer, smart storage that never deletes without asking, and **educator mode**.
- **Show the process**: a one-page summary of a board and how everything on it was made, for classrooms.
- Boards save automatically on your computer, and can be saved as files. Undo/redo throughout.

### Which AI does the work

1. **Private AI on your computer** (Ollama, and an image studio) always comes first.
2. **Online assistant**: only in the claude.ai preview, only when no private AI is found, and never in educator mode. It's labelled "online" wherever it's used. It can chat, write and describe pictures. It cannot make pictures.
3. **Nothing installed**: plans, storyboards, the built-in voice and every recipe still work. Making a picture needs a picture model (see above). Admin shows exactly what's missing.

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
- [Critical review](docs/REVIEW.md): the idea, the flaws, the open questions, and solutions

The repository's previous landing page is kept at `legacy/domainforge-landing.html`.
