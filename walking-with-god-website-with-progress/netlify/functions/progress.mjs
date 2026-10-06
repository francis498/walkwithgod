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

const MAX_FAILS = 10, WINDOW_MS = 15 * 60 * 1000;

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  let body = {};
  try { body = await req.json(); } catch (_) { return json({ error: "Bad request." }, 400); }
  const { action, name, code, data } = body;
  if (action === "health") return json({ ok: true });

  if (!normName(name) || !/^\d{4,8}$/.test(String(code || "")))
    return json({ error: "Please enter a name and a 4-digit code." }, 400);
  if (data && JSON.stringify(data).length > 200000) return json({ error: "Too much data." }, 413);

  const users = getStore({ name: "wwg-users", consistency: "strong" });
  const guard = getStore({ name: "wwg-guard", consistency: "strong" });
  const now = Date.now();

  // Slow down guessing: 10 wrong tries per name in 15 minutes locks that name for a while.
  const nk = nameKey(name);
  const g = (await guard.get(nk, { type: "json" })) || { fails: [] };
  g.fails = g.fails.filter((t) => now - t < WINDOW_MS);
  if (g.fails.length >= MAX_FAILS) return json({ error: "Too many tries. Please wait 15 minutes and try again." }, 429);

  const key = userKey(name, code);

  if (action === "create") {
    const rec = { name: String(name).trim().slice(0, 60), created: now, updated: now, data: data || {} };
    const res = await users.setJSON(key, rec, { onlyIfNew: true });
    if (res && res.modified === false)
      return json({ error: "That name and code are already in use. Choose “I have a code” to sign in, or pick a different code." }, 409);
    return json({ ok: true, name: rec.name, data: rec.data });
  }

  const rec = await users.get(key, { type: "json" });
  if (!rec) {
    g.fails.push(now); await guard.setJSON(nk, g);
    return json({ error: "We couldn't find that name and code. Check the spelling of the name and the 4 digits." }, 404);
  }
  if (g.fails.length) await guard.delete(nk);

  if (action === "load") return json({ ok: true, name: rec.name, data: rec.data || {} });

  if (action === "save") {
    rec.data = mergeData(rec.data || {}, data || {});
    rec.updated = now;
    await users.setJSON(key, rec);
    return json({ ok: true, updated: now, data: rec.data });
  }
  return json({ error: "Unknown action." }, 400);
};

export const config = { path: "/api/progress" };
