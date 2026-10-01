// Kleine Helfer für JSON-Antworten und Admin-Authentifizierung

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });
}

export function error(code, status = 400, extra = {}) {
  return json({ ok: false, error: code, ...extra }, status);
}

// Vergleich in konstanter Zeit, damit das Passwort nicht über Antwortzeiten erraten werden kann
export async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b))),
  ]);
  const va = new Uint8Array(ha);
  const vb = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

export async function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) return error("admin_not_configured", 503);
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !(await safeEqual(token, env.ADMIN_TOKEN))) return error("unauthorized", 401);
  return null;
}

export function clean(s, max = 500) {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);
}

export function isEmail(s) {
  return typeof s === "string" && s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
