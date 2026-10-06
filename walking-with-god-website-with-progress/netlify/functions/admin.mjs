import { getStore } from "@netlify/blobs";
import crypto from "node:crypto";

// ---- shared helpers ----
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

const normName = (n) => String(n || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
// The user's code is never stored; it only forms part of the private key.
const userKey = (name, code) => sha("u|" + normName(name) + "|" + String(code).trim());
const nameKey = (name) => sha("n|" + normName(name));

function getEnv(k) {
  try { if (globalThis.Netlify?.env?.get) { const v = Netlify.env.get(k); if (v) return v; } } catch (_) {}
  return process.env[k];
}

// Merge two saved progress objects. Each day keeps whichever copy was changed most recently.
function mergeData(a = {}, b = {}) {
  const out = { ...a, ...b };
  const prog = {}, progT = {};
  const days = new Set([...Object.keys(a.prog || {}), ...Object.keys(b.prog || {})]);
  for (const d of days) {
    const ta = (a.progT || {})[d] || 0, tb = (b.progT || {})[d] || 0;
    if (tb >= ta && b.prog && d in b.prog) { prog[d] = b.prog[d]; progT[d] = tb; }
    else { prog[d] = (a.prog || {})[d]; progT[d] = ta; }
  }
  out.prog = prog; out.progT = progT;
  const da = a.dayT || 0, db = b.dayT || 0;
  out.day = db >= da ? b.day ?? a.day : a.day; out.dayT = Math.max(da, db);
  return out;
}

// ---- handler ----

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

function summarize(key, r) {
  const d = r.data || {}, s = d.summary || {};
  const times = Object.values(d.progT || {}).filter(Boolean);
  const lastActive = Math.max(r.updated || 0, ...times, 0);
  const now = Date.now(), day = 864e5;
  const dates = new Set(times.map((t) => new Date(t).toISOString().slice(0, 10)));
  const activeIn = (n) => [...dates].filter((ds) => now - Date.parse(ds) < n * day).length;
  return {
    key, name: r.name, created: r.created, lastActive,
    currentDay: d.day || 1, done: s.done || 0, started: s.started || 0,
    active7: activeIn(7), active30: activeIn(30),
  };
}

export default async (req) => {
  const pw = getEnv("ADMIN_PASSWORD");
  if (!pw) return json({ error: "The dashboard password has not been set yet. Add ADMIN_PASSWORD in Netlify's environment variables, then redeploy." }, 500);

  const guard = getStore({ name: "wwg-guard", consistency: "strong" });
  const gk = nameKey("__admin__"), now = Date.now();
  const g = (await guard.get(gk, { type: "json" })) || { fails: [] };
  g.fails = g.fails.filter((t) => now - t < 15 * 60 * 1000);
  if (g.fails.length >= 10) return json({ error: "Too many wrong passwords. Wait 15 minutes." }, 429);
  if (!same(req.headers.get("x-admin-password") || "", pw)) {
    g.fails.push(now); await guard.setJSON(gk, g);
    return json({ error: "Wrong password." }, 401);
  }

  const users = getStore({ name: "wwg-users", consistency: "strong" });
  if (req.method === "DELETE") {
    const { key } = await req.json().catch(() => ({}));
    if (!key) return json({ error: "Missing user." }, 400);
    await users.delete(key);
    return json({ ok: true });
  }
  const { blobs } = await users.list();
  const list = (await Promise.all(blobs.map(async (b) => {
    const r = await users.get(b.key, { type: "json" });
    return r ? summarize(b.key, r) : null;
  }))).filter(Boolean);
  return json({ users: list });
};

export const config = { path: "/api/admin" };
