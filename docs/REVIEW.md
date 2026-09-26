# Critical review: the idea, the product, the gaps

*September 2026. Covers the idea, the current build on `claude/visual-ai-learning-platform-kzx5ks`, and the decisions still open. Every problem comes with a proposed solution. Priority: **P0** blocks real users, **P1** hurts them, **P2** is polish.*

---

## 1. Verdict

The idea is good and distinctive: **the board is the prompt, and the app always shows how the board became the prompt.** That transparency ("Here's how your board becomes instructions", "How this was made", "How this was edited") is the one thing competitors don't do, and it is the product. Everything else (tools, video, themes) is a vehicle for it.

The build is a strong prototype, not a product. Three things stand between it and real users:

1. **No real AI has been exercised end to end.** Every AI path was tested against stand-ins. The first real run will be on your PC.
2. **"Local-first" and "for ordinary people" pull in opposite directions.** Private text AI is realistic on a normal laptop. Private pictures are hard. Private AI video is out of reach without a graphics card. The product has to be honest about that, and it has to decide what beginners get by default.
3. **The core claim, that visual prompting is easier than typing, has never been tested with a single beginner.**

---

## 2. The idea: what's strong, what's shaky

### Strong

- **Transparency as the teacher.** Most AI tools hide the prompt. Here, every result shows its ingredients, why each was used, and the exact words sent. That is real AI literacy, not a lesson bolted on.
- **Relationships over phrasing.** "Looks like", "in the style of" and "features" teach the concepts that actually matter (reference, style, consistency) without prompt jargon.
- **Honesty built in.** Sketches are labelled as sketches, online AI is labelled as online, and the Video Maker says when no AI was used. Trust is a feature for this audience.
- **Works before setup.** A beginner can learn the whole flow with nothing installed.

### Shaky

**2.1 The central claim is unproven.**
Connecting cards is a new skill in its own right: reading a graph. Some people find a mind map harder than typing one sentence. If visual prompting isn't actually easier, the product has no reason to exist.
*Solution:* five beginner sessions before any more features. Give each person the same task ("make a picture of your pet as a superhero"), once by typing into a plain prompt box and once on the board. Measure time, success, and whether they can explain why the result looks the way it does. That explain-back test is the product's real success metric.

**2.2 The recipe is honest but naive.**
The board's words are joined in a fixed order ("A hero… Looks like: … Style: …"). That is great for learning cause and effect, but image models often do better with a fluent sentence. So the quality currently comes from "Smooth the wording", which quietly teaches that you need an AI to rewrite your words for another AI.
*Solution:* keep the deterministic recipe as the default teaching view, and make the rewrite explicit and educational. Show the two versions side by side (already done) and add a one-line "what changed" note ("joined the details into one scene; moved the style to the end"). Longer term, write the recipe per engine (image, video, text), each with its own clearly shown template.

**2.3 Randomness undermines the "fair test" lesson.**
Discoveries teach "change one thing at a time", but image AI gives a different picture each run, even with nothing changed. The compare view already admits this.
*Solution:* store a seed with every creation, and offer a toggle, "Keep the same starting point", that reuses it. That teaches seeds in plain words and makes comparisons genuinely fair.

**2.4 Close competitors exist.**
Node-canvas AI tools for creatives (Flora, Weavy/Figma Weave, Krea nodes, tldraw's AI experiments, Miro and Canva AI) already offer "cards on a canvas that call AI".
*Solution:* don't compete on features. Compete on **explainability, privacy and learning**: recipes, "How this was made", discoveries, educator mode, and a local AI option. Keep the guardrail against becoming a node editor, because that's the ground the others already hold.

**2.5 The education market and local-first conflict.**
Schools lock down installs, many students use Chromebooks (which can't run Ollama), and multi-gigabyte model downloads on school networks are a non-starter.
*Solution:* a **classroom server mode**. One teacher machine or school server runs the AI, and students connect over the school network from a browser. Nothing leaves the building, and nobody installs anything. That keeps the privacy promise and fits school IT.

---

## 3. Flaws in the current build, with solutions

### P0: blocks real users

| # | Flaw | Why it matters | Solution |
|---|------|----------------|----------|
| 1 | No real AI tested end to end (Ollama, Qwen, image studio, AI-directed video) | Unknown failure modes on first real use | Run on your PC. Add a **"Check my AI"** button in Your AI that sends a tiny real request to each service and reports in plain words what works. Put the browser tests in the repo so they run against real Ollama in CI. |
| 2 | Private pictures need AUTOMATIC1111 or Forge | Far too technical for the audience; Ollama's own image generation was experimental and has been removed | **Decision needed** (section 4). Best option: ship a bundled picture engine in the desktop app (a small, fast model through stable-diffusion.cpp as a sidecar), installed from the Model Library with one click. Until then, say plainly that pictures are sketches or online illustrations. |
| 3 | True AI video needs a graphics card most users don't have | The promise of "video" sets an expectation the hardware can't meet | Three honest tiers, labelled everywhere: **Camera-move edits** (every computer), **AI-directed edits** (any computer with Qwen), **AI motion** (graphics card locally, or an optional, clearly priced online service). The Model Library should tell people which tier their computer supports. |
| 4 | Pictures and videos are stored inside the board document | A few videos (about 5 MB each) make every autosave rewrite megabytes; boards get slow and can hit browser storage limits | Store assets separately (blobs in IndexedDB in the browser, files in the desktop app) with the board holding only references. Autosave then writes kilobytes. |
| 5 | No content safety for children | Local models have no moderation; one bad output in a classroom ends a school deployment | In educator mode: a word filter on recipes, plus a small on-device image safety check before a creation is shown. Teachers can see flagged items. Document the limits honestly. |
| 6 | Mac and Windows installers never built; installers unsigned | Windows and macOS warn or block unsigned apps; beginners won't click through | Run the Desktop app workflow once. Buy signing certificates (Windows code signing, Apple Developer ID) before any public release. Add auto-update. |

### P1: hurts users

| # | Flaw | Solution |
|---|------|----------|
| 7 | Board files are imported with minimal validation | Validate the full structure on import (card kinds, sizes, data URLs) and repair or refuse with a clear message. |
| 8 | The Producer can't act on the board, even when an assistant is on | Give it tools ("add card", "connect", "add tool") with a preview the person confirms: "I'd like to add these 3 cards. OK?" That is Phase 2's real goal. |
| 9 | The Producer only understands keyword templates when offline | Fine for now. Add more templates, written with teachers. |
| 10 | Emoji icons look different on every system and clash with the Neon look | Draw one small icon set (idea, note, picture, character, style, tool, video) as inline SVG in both themes. |
| 11 | No multi-select, grouping, copy/paste or search | Needed as soon as boards pass about 20 cards. Add box-select, group move, duplicate and a "find a card" search. |
| 12 | The canvas isn't usable by keyboard or screen reader | Tab through cards, arrow keys to move, Enter to connect, and an "outline view" that reads the board as a list (reuse `describeBoard`). |
| 13 | Discoveries are one-off pop-ups; nothing checks understanding | Add optional reflection prompts in educator mode ("Why do you think the AI added a hat?") and include answers in "Show the process". |
| 14 | Browser tests live outside the repo | Move them into `tests/e2e` with Playwright and run them in CI. |
| 15 | The recipe gathers two steps of connections and nothing more | Two steps is a sensible default. Show greyed "not included (too far away)" cards in the recipe so people learn *why* something was left out. |

### P2: polish

- The Neon look is the new default. Watch in user sessions whether it reads as calm or as intimidating, and keep Daylight one click away (it is).
- Picture captions are single-line; allow two lines.
- "Show the process" could include the videos' edit plans.
- Undo is per action; text edits undo as one block when a field gains focus.

---

## 4. Questions we need to answer

Each has a recommendation. These decide the next three months more than any feature does.

1. **Who is the first user, exactly?**
   Teachers, curious adults and hobby creators need different things.
   *Recommendation:* **curious adults, 40+**, who feel left behind by AI. They have laptops (not Chromebooks), install apps themselves, and the "I understand what's happening" promise speaks to them most. Teachers come second, through classroom server mode.

2. **Is online AI allowed, and on what terms?**
   *Recommendation:* yes, as an **optional, clearly labelled, pay-as-you-go** extra for things a normal computer can't do (AI video, high-quality pictures). Never the default, never a subscription gate, always off in educator mode. That funds development without becoming the cloud trap the brief warns against.

3. **What do beginners get for pictures by default?**
   *Recommendation:* a bundled small picture engine in the desktop app (see P0 #2). If that proves too slow on ordinary laptops, the default becomes online illustrations, with private pictures as an upgrade.

4. **Desktop app or web app first?**
   *Recommendation:* **desktop first** for private AI, with the web version kept as the zero-install "try it" experience and the classroom client.

5. **How do we know people learned something?**
   *Recommendation:* the explain-back test. After making something, can they say why it looks the way it does? Build it into user sessions now and into educator mode later.

6. **What is it called?**
   "Workshop" is generic and hard to search for. It needs a real name before any public release, one that says "learn AI by making things" and isn't taken.

7. **How does it make money if education is free?**
   *Recommendation:* (a) the optional online power extras (question 2), (b) a paid creator tier for commercial licence clarity, more tools and larger projects, and (c) supporter tiers. Schools stay free.

8. **Which models can we legally ship or recommend?**
   Model licences differ (some restrict commercial use or require attribution). This matters for a paid tier.
   *Recommendation:* keep a licence note in the Model Library catalogue for each model, and only bundle models whose licences allow commercial distribution.

9. **Consent and likeness.**
   People will put photos of real people, including children, into picture and video tools.
   *Recommendation:* a gentle consent check when a photo with a face is used ("Do you have permission to use this person's picture?"), a discovery that explains why it matters, and no face-swap tools at all.

10. **Neon or calm?**
    You asked for a cyber look, and the brief asks for calm and reassuring. They can coexist: glow only on what matters, generous space, no flicker.
    *Recommendation:* Neon as the default for creators, Daylight as the default in educator mode, and validate both with users.

---

## 5. What I'd do next, in order

1. **Real-AI shakedown on your PC** (days): Ollama with llama3.2 and qwen2.5vl, the Video Maker directed by Qwen, plus the "Check my AI" button. Fix everything that breaks.
2. **Five beginner sessions** (1 to 2 weeks): the typed-prompt-vs-board comparison and the explain-back test. Decide from evidence whether the board earns its place.
3. **Storage and safety foundations** (2 to 3 weeks): separate asset storage, import validation, and the educator-mode safety filter.
4. **The picture decision** (2 to 4 weeks): prototype a bundled small picture engine in the desktop app and measure it on an ordinary laptop. Keep it or fall back to online illustrations.
5. **A signed release for Windows and Mac**, with a real name.

---

## 6. What changed in this round

- **New look: Neon** (default). A deep night-blue board with a faint cyan grid, cards that glow in their own colour, a slow pulse travelling along connections (information flowing), monospace labels, and a new logo of two connected nodes. The warm original is still one click away as **Daylight** (☀/☾ in the top bar).
- Every hard-coded colour now comes from shared colour variables, so both looks stay consistent and a third would be easy to add.
- When a panel is open, discovery pop-ups move aside instead of covering it.
