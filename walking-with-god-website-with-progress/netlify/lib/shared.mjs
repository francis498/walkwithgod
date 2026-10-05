import crypto from "node:crypto";

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export const normName = (n) => String(n || "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
// The user's code is never stored; it only forms part of the private key.
export const userKey = (name, code) => sha("u|" + normName(name) + "|" + String(code).trim());
export const nameKey = (name) => sha("n|" + normName(name));

export function getEnv(k) {
  try { if (globalThis.Netlify?.env?.get) { const v = Netlify.env.get(k); if (v) return v; } } catch (_) {}
  return process.env[k];
}

// Merge two saved progress objects. Each day keeps whichever copy was changed most recently.
export function mergeData(a = {}, b = {}) {
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
