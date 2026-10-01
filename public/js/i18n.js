// Sprachumschaltung (DE/EN). Texte liegen in /i18n/de.json und /i18n/en.json.
export const LANGS = ["de", "en"];
let dict = {};
let current = "de";

function storageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function storageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* egal */ } }

export function detectLang() {
  const q = new URLSearchParams(location.search).get("lang");
  if (LANGS.includes(q)) return q;
  const saved = storageGet("lang");
  if (LANGS.includes(saved)) return saved;
  return (navigator.language || "de").toLowerCase().startsWith("de") ? "de" : "en";
}

export function lang() { return current; }

export function t(key, vars = {}) {
  let s = dict[key] ?? key;
  for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}

export async function setLang(l) {
  current = LANGS.includes(l) ? l : "de";
  const res = await fetch(`i18n/${current}.json`);
  dict = await res.json();
  storageSet("lang", current);
  document.documentElement.lang = current;
  const url = new URL(location.href);
  url.searchParams.set("lang", current);
  history.replaceState(null, "", url);
  applyStatic();
  document.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === current)));
}

export function applyStatic(root = document) {
  root.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
  root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    for (const pair of el.dataset.i18nAttr.split(";")) {
      const [attr, key] = pair.split(":");
      el.setAttribute(attr.trim(), t(key.trim()));
    }
  });
}

export function fmtMoney(amount, currency = "EUR") {
  const opts = { style: "currency", currency, minimumFractionDigits: amount % 1 ? 2 : 0, maximumFractionDigits: 2 };
  return new Intl.NumberFormat(current === "de" ? "de-DE" : "en-GB", opts).format(amount);
}

export function fmtDate(iso, opts = { day: "numeric", month: "short", year: "numeric" }) {
  return new Intl.DateTimeFormat(current === "de" ? "de-DE" : "en-GB", { ...opts, timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));
}
