# Workshop: product vision

> **Learn AI by building.**
> Your AI. Your computer. Your ideas.

*"Workshop" is a working name. It is defined once in the UI (`src/ui/TopBar.tsx`, `index.html`) so it is easy to change.*

## The one question

Every product decision is checked against:

> **Does this help ordinary people understand how AI works?**

If yes, build it. If no, question it.

## What we are building

A local-first **visual thinking environment** where people learn to work with AI by making things.

People place ideas, notes, pictures, characters and styles on an infinite board and connect them. **The connections become the instructions.** The board itself is the prompt, and the app always shows how the board was turned into words the AI reads.

Most AI tools look like this:

```
Prompt → magic → result
```

Workshop shows the thinking:

```
Idea → references → planning → recipe → creation → review → next version
```

We are **not** building an AI image generator, a ComfyUI clone, a no-code AI tool or a prompt-engineering tool. Picture-making is the first thing people can do on the board, because it gives fast, visible feedback. It is a teaching medium, not the product.

## Who it is for

People who feel that AI is a black box that is not meant for them: parents, teachers, students, small business owners, retired people, curious creators. No coding, prompt writing, technical knowledge or AI expertise is needed.

They should come away thinking *"I understand what's happening"*, not *"I have no idea how this works"*.

## Product principles

1. **Everything visible.** If the AI uses something, it is on the board. If it says something, you can see why.
2. **Everything explainable.** Every result has a "How this was made" view: the cards that went in, why each one mattered, and the exact words sent.
3. **Everything approachable.** Calm colours, rounded shapes, plain words, generous undo. Nothing sharp, nothing scary.
4. **Relationships, not prompts.** People learn that references, context and structure shape results by connecting cards, not by studying phrasing tricks.
5. **Learning by doing.** No lessons, no coursework. Short discoveries appear at the moment they are relevant and collect in a Discoveries list.
6. **Honest about the machine.** Sketch previews are labelled as sketches. The assistant's rewrites are shown next to the original. We never pass off a placeholder as AI output, and never hide a step.
7. **Works before setup.** A beginner can learn the whole flow before installing any AI. When AI is installed, the same board produces real results.

## Local-first and private

- People own their files, their models and their data.
- Boards are saved on the computer. They can be saved as a file and opened again anywhere.
- AI runs on local hardware. The cloud is optional, and never required to learn.
- Users see "Personal AI Assistant", "Private AI", "Runs on your computer", "Works offline". They never need to know which runtime is underneath (today, Ollama). Technical details live behind a "for the curious" disclosure.

## Language guide

| Say | Don't say |
| --- | --- |
| Idea, note, picture, character, style | Node, block, input, asset |
| Connection, "looks like", "in the style of" | Edge, link type, conditioning |
| Recipe, "what the AI will read" | Prompt, prompt template |
| Personal AI Assistant, private AI | Ollama, LLM, model, inference |
| Image studio | Stable Diffusion, A1111, checkpoint, sampler |
| "Your computer can comfortably run these" | "You have 8 GB VRAM" |
| Make a picture, create | Generate, run, execute |
| Smooth the wording | Prompt enhancement, rewrite chain |

Technical names can appear only inside an explicit "for the curious" section.

## Positioning

Market it as:

- "Learn AI by building."
- "Think visually. Create with AI."
- "The visual workspace that teaches AI through creation."
- "Build ideas, not prompts."
- "Your personal AI workshop."

Never as an AI image generator, AI video generator, no-code AI tool or ComfyUI alternative.

## Guardrails

The platform must not become:

- ComfyUI for beginners
- a technical node editor (no ports, no typed sockets, no parameter panels on the board)
- a prompt-engineering tool
- a cloud subscription trap

When there is tension, choose **understanding, creativity, learning and approachability** over complexity, technical flexibility and power-user features. Power features, if ever added, live behind progressive disclosure and never change the beginner's first experience.

## Success

The product succeeds when a complete beginner can:

1. open the board,
2. connect ideas visually,
3. understand what the AI is doing,
4. create something meaningful, and
5. learn something in the process,

without ever needing to learn how the underlying technology works.

### How we will measure it

- **Time to first creation** from first launch (target: under 3 minutes with the example).
- **Connection rate:** share of creations that used at least one connection (evidence that visual prompting is understood).
- **Recipe opens:** share of people who open "How this was made" at least once.
- **Explain-back test:** in user sessions, can a beginner explain in their own words why their picture looked the way it did?

All measurement is opt-in and local-first. Nothing is collected by default.

## Monetisation, in line with the mission

- **Free, always:** educators, students, schools, libraries, non-profits and educational charities.
- **Paid:** creators, freelancers, businesses and agencies using it commercially.
- **Supporters:** community supporter tiers (e.g. Patreon) with early access, experimental workflow tiles, community templates and roadmap voting.

Commercial users fund development. The learning path stays free, and the local-first core never depends on a subscription.
