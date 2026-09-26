# Spice.ai for Workshop

[Spice.ai](https://github.com/spiceai/spiceai) is a free, open-source program that runs on your computer and serves AI models through one address. Workshop can use it for chat, writing, reading pictures and planning video edits.

`spicepod.yaml` in this folder is ready to go. It connects:

| Model name | Where it runs | Needs |
| --- | --- | --- |
| `local-ollama-chat` | Your computer (private) | Ollama running, `ollama pull llama3.2` |
| `local-ollama-vision` | Your computer (private) | `ollama pull qwen2.5vl:3b` |
| `hf-qwen-chat` | Hugging Face (online) | A Hugging Face token in `.env` |
| `hf-qwen-vision` | Hugging Face (online) | A Hugging Face token in `.env` |
| `local-hf-llama` (off) | Your computer, run by Spice | Big download; remove the `#` signs to switch on |
| `local-file-model` (off) | Your computer, from a folder | A model folder in `spice/models/` |

## Set up (about 5 minutes)

1. Install Spice:
   - Mac or Linux: `curl https://install.spiceai.org | /bin/bash` (or `brew install spiceai/spiceai/spice`)
   - Windows (PowerShell): `iex ((New-Object System.Net.WebClient).DownloadString("https://install.spiceai.org/Install.ps1"))`
2. Optional, for the `hf-` models: copy `.env.example` to `.env` and paste your Hugging Face token.
3. Start it from this folder:
   ```
   cd spice
   spice run
   ```
4. In Workshop, open **⚡ AI Hub** → **🌶️ Spice.ai**, press **Look again**, pick a model, and press **Test**. Choose **Spice.ai** under "Chat & writing" (or leave **Auto**).

Spice listens on `http://127.0.0.1:8090`. In the browser version Workshop reaches it through the dev server at `/local/spice`, so no extra settings are needed.

## Notes

- Spice doesn't make pictures or videos. Pictures come from Hugging Face or an image studio (AI Hub), and videos from Workshop's Video Maker, which can use a Spice vision model to plan the edit.
- Tick "This model can look at pictures" in the AI Hub only for the `-vision` models.
