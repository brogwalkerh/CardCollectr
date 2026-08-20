// Vercel serverless function: /api/archidekt/* -> https://archidekt.com/api/*
//
// Archidekt's API hardcodes Access-Control-Allow-Origin to
// http://localhost:3000, so browsers anywhere else can't call it directly.
// This proxy runs server-side on Vercel, adds a descriptive User-Agent
// (politeness), and returns the response with open CORS headers so the
// CardCollectr frontend (same Vercel deployment, or the GitHub Pages copy)
// can collect decks from the browser.
//
// Scope is deliberately tiny: GET only, and only the two read endpoints the
// collector uses — this is not an open proxy.
//
// Rate limiting note: serverless instances are stateless, so politeness
// throttling (1 request/second) is enforced by the browser client
// (src/utils/archidektClient.ts), which is the only caller.

const CONTACT_EMAIL = process.env.ARCHIDEKT_CONTACT_EMAIL ?? "brogwalkerh@gmail.com";
const USER_AGENT = `CardCollectr-DeckCollector/0.1 (browser collector via Vercel proxy; contact: ${CONTACT_EMAIL})`;

// Minimal request/response typings so we don't need the @vercel/node package.
interface VercelishRequest {
  method?: string;
  url?: string;
}
interface VercelishResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelishResponse;
  json(body: unknown): void;
  send(body: string): void;
  end(): void;
}

export default async function handler(req: VercelishRequest, res: VercelishResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // public read-only data
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "GET only" });
    return;
  }

  // req.url is like /api/archidekt/decks/v3/?page=1&formats=3
  const url = new URL(req.url ?? "/", "http://internal");
  const subPath = url.pathname.replace(/^\/api\/archidekt\/?/, "");

  // Allowlist: deck search (decks/v3/) and single deck (decks/{id}/) only.
  const allowed = /^decks\/v3\/?$/.test(subPath) || /^decks\/\d+\/?$/.test(subPath);
  if (!allowed) {
    res.status(404).json({ error: "unsupported path", path: subPath });
    return;
  }

  try {
    const upstream = await fetch(`https://archidekt.com/api/${subPath}${url.search}`, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
    const body = await upstream.text();
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/json");
    // Pass the upstream status through untouched so the client's retry
    // logic sees real 429/5xx codes.
    res.status(upstream.status).send(body);
  } catch (err) {
    res.status(502).json({ error: `proxy fetch failed: ${err instanceof Error ? err.message : String(err)}` });
  }
}
