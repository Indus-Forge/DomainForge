/// <reference types="vitest/config" />
import { defineConfig, type Connect, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// The browser talks to AI running on this computer through these local paths.
// Keeping them same-origin avoids asking people to configure CORS by hand.
const privateAI = process.env.WORKSHOP_PRIVATE_AI_URL ?? 'http://127.0.0.1:11434';
const imageStudio = process.env.WORKSHOP_IMAGE_STUDIO_URL ?? 'http://127.0.0.1:7860';

const proxy = {
  '/local/ai': { target: privateAI, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/local\/ai/, '') },
  '/local/images': { target: imageStudio, changeOrigin: true, rewrite: (p: string) => p.replace(/^\/local\/images/, '') },
};

/** Online services that don't accept requests from web pages, reached through the dev server instead. */
const FORWARD_ONLINE = ['api.tavily.com'];
const LOOPBACK = ['127.0.0.1', 'localhost', '[::1]'];
const PASS_HEADERS = ['content-type', 'authorization', 'accept'];
const DROP_HEADERS = ['content-encoding', 'content-length', 'transfer-encoding', 'connection'];

/**
 * /local/forward/<address>: forwards a request to a service on this computer
 * (any port) or to one of the few online services above, so the browser
 * version can reach them without CORS settings. Anything else is refused.
 */
function forwardLocal(): Plugin {
  const handle: Connect.NextHandleFunction = async (req, res, next) => {
    if (!req.url?.startsWith('/local/forward/')) return next();
    let target: URL;
    try {
      target = new URL(decodeURIComponent(req.url.slice('/local/forward/'.length)));
    } catch {
      res.statusCode = 400;
      return res.end('That address isn’t valid.');
    }
    const allowed = /^https?:$/.test(target.protocol) && (LOOPBACK.includes(target.hostname) || FORWARD_ONLINE.includes(target.hostname));
    if (!allowed) {
      res.statusCode = 403;
      return res.end('Only services on this computer can be reached this way.');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const headers: Record<string, string> = {};
    for (const h of PASS_HEADERS) if (typeof req.headers[h] === 'string') headers[h] = req.headers[h] as string;
    try {
      const reply = await fetch(target, {
        method: req.method,
        headers,
        body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
      });
      res.statusCode = reply.status;
      reply.headers.forEach((value, key) => {
        if (!DROP_HEADERS.includes(key)) res.setHeader(key, value);
      });
      if (reply.body) for await (const piece of reply.body) res.write(piece);
      res.end();
    } catch {
      res.statusCode = 502;
      res.end('Nothing answered at that address.');
    }
  };
  return {
    name: 'workshop-forward-local',
    configureServer: (server) => void server.middlewares.use(handle),
    configurePreviewServer: (server) => void server.middlewares.use(handle),
  };
}

export default defineConfig({
  plugins: [react(), forwardLocal()],
  // The desktop app (src-tauri) loads the dev server from this exact port.
  clearScreen: false,
  server: { port: 5173, strictPort: true, proxy, watch: { ignored: ['**/src-tauri/**'] } },
  preview: { proxy },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
