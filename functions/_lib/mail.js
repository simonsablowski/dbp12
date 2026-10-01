// E-Mail-Versand über Resend (https://resend.com). Ohne RESEND_API_KEY werden
// die Mails nur ins Log geschrieben, damit lokal alles funktioniert.
import { config } from "./stay.js";
import { escapeHtml } from "./http.js";

async function send(env, { to, subject, html, replyTo }) {
  if (!to) return { skipped: "no_recipient" };
  if (!env.RESEND_API_KEY) {
    console.log(`[mail:dry-run] to=${to} subject=${subject}`);
    return { skipped: "no_api_key" };
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, html, reply_to: replyTo }),
  });
  if (!res.ok) console.error("[mail] failed", res.status, await res.text());
  return { ok: res.ok };
}

const T = {
  de: {
    subject: (id) => `Buchungsbestätigung ${id} – Dora-Benjamin-Park 12`,
    hello: (n) => `Hallo ${n},`,
    intro: "vielen Dank für deine Buchung. Hier sind die Details:",
    ref: "Buchungsnummer",
    arrival: "Anreise",
    departure: "Abreise",
    guests: "Personen",
    adults: "Erwachsene",
    children: "Kinder",
    total: "Gesamtbetrag",
    payment: "Zahlung",
    cash: "Bar bei Ankunft und Schlüsselübergabe",
    online: "Online bezahlt",
    checkin: (f, u) => `Check-in zwischen ${f} und ${u} Uhr`,
    checkout: (b) => `Check-out bis ${b} Uhr`,
    rules: "Du hast die Hausordnung & Mietbedingungen akzeptiert. Du findest sie jederzeit hier:",
    contact: "Bitte schreib uns kurz vor der Anreise, wann du ungefähr ankommst. Bei Fragen antworte einfach auf diese E-Mail.",
    bye: "Bis bald!",
    nights: "Nächte",
  },
  en: {
    subject: (id) => `Booking confirmation ${id} – Dora-Benjamin-Park 12`,
    hello: (n) => `Hello ${n},`,
    intro: "thank you for your booking. Here are the details:",
    ref: "Booking reference",
    arrival: "Arrival",
    departure: "Departure",
    guests: "Guests",
    adults: "adults",
    children: "children",
    total: "Total",
    payment: "Payment",
    cash: "Cash on arrival at key handover",
    online: "Paid online",
    checkin: (f, u) => `Check-in between ${f} and ${u}`,
    checkout: (b) => `Check-out by ${b}`,
    rules: "You have accepted the house rules and terms. You can read them again here:",
    contact: "Please let us know shortly before your arrival roughly when you will arrive. If you have questions, simply reply to this email.",
    bye: "See you soon!",
    nights: "nights",
  },
};

function fmtDate(iso, lang) {
  const d = new Date(iso + "T12:00:00Z");
  return new Intl.DateTimeFormat(lang === "de" ? "de-DE" : "en-GB", {
    weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin",
  }).format(d);
}

function fmtMoney(cents, lang) {
  return new Intl.NumberFormat(lang === "de" ? "de-DE" : "en-GB", { style: "currency", currency: config.currency }).format(cents / 100);
}

function layout(body) {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ec;font-family:Georgia,serif;color:#1f2a2e">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;background:#fff">
  <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#4a6b70;margin:0 0 24px">Dora-Benjamin-Park 12 · Berlin-Stralau</p>
  ${body}
  </div></body></html>`;
}

function row(label, value) {
  return `<tr><td style="padding:6px 16px 6px 0;color:#5b6b6e;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0">${value}</td></tr>`;
}

export async function sendGuestConfirmation(env, b) {
  const lang = b.language === "en" ? "en" : "de";
  const t = T[lang];
  const s = config.stay;
  const breakdown = b.price_breakdown ? JSON.parse(b.price_breakdown) : null;
  const guests = `${b.adults} ${t.adults}${b.children ? `, ${b.children} ${t.children}` : ""}`;
  const html = layout(`
    <p>${escapeHtml(t.hello(b.guest_name))}</p>
    <p>${t.intro}</p>
    <table style="border-collapse:collapse;font-size:15px;margin:16px 0">
      ${row(t.ref, `<strong>${escapeHtml(b.id)}</strong>`)}
      ${row(t.arrival, `${fmtDate(b.check_in, lang)}<br><span style="color:#5b6b6e">${t.checkin(s.checkInFrom, s.checkInUntil)}</span>`)}
      ${row(t.departure, `${fmtDate(b.check_out, lang)}<br><span style="color:#5b6b6e">${t.checkout(s.checkOutBy)}</span>`)}
      ${row(t.guests, escapeHtml(guests))}
      ${breakdown ? row(t.nights, String(breakdown.nights)) : ""}
      ${row(t.total, `<strong>${fmtMoney(b.amount_cents, lang)}</strong>`)}
      ${row(t.payment, b.payment_method === "cash" ? t.cash : t.online)}
    </table>
    <p>${t.rules}<br><a href="${env.PUBLIC_URL}/?lang=${lang}#rules" style="color:#2f6f73">${env.PUBLIC_URL}/?lang=${lang}#rules</a></p>
    <p>${t.contact}</p>
    <p>${t.bye}<br>${escapeHtml(config.contact.hostName)}</p>`);
  return send(env, { to: b.guest_email, subject: t.subject(b.id), html, replyTo: env.HOST_EMAIL || config.contact.hostEmail || undefined });
}

export async function sendHostNotification(env, b) {
  const to = env.HOST_EMAIL || config.contact.hostEmail;
  const html = layout(`
    <p><strong>Neue Buchung ${escapeHtml(b.id)}</strong></p>
    <table style="border-collapse:collapse;font-size:15px">
      ${row("Zeitraum", `${fmtDate(b.check_in, "de")} bis ${fmtDate(b.check_out, "de")}`)}
      ${row("Personen", `${b.adults} Erwachsene, ${b.children} Kinder`)}
      ${row("Gast", escapeHtml(b.guest_name))}
      ${row("E-Mail", escapeHtml(b.guest_email))}
      ${row("Telefon", escapeHtml(b.guest_phone || "–"))}
      ${row("Sprache", b.language === "en" ? "Englisch" : "Deutsch")}
      ${row("Betrag", fmtMoney(b.amount_cents, "de"))}
      ${row("Zahlung", b.payment_method === "cash" ? "Bar bei Ankunft" : escapeHtml(b.payment_method))}
      ${row("Nachricht", escapeHtml(b.guest_message || "–").replace(/\n/g, "<br>"))}
      ${row("Hausordnung", `Version ${escapeHtml(b.rules_version)}, akzeptiert ${escapeHtml(b.rules_accepted_at)}`)}
    </table>
    <p><a href="${env.PUBLIC_URL}/admin.html" style="color:#2f6f73">Zur Übersicht</a></p>`);
  return send(env, { to, subject: `Neue Buchung ${b.id}: ${b.check_in} bis ${b.check_out}`, html, replyTo: b.guest_email });
}
