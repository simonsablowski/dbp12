// GET /api/calendar?token=...  – iCal-Feed aller aktiven Buchungen und Sperrzeiten.
// Kann in Google Kalender über "Andere Kalender → Per URL" abonniert werden.
import { ACTIVE_STATUS_SQL } from "../_lib/db.js";
import { safeEqual } from "../_lib/http.js";

function esc(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}
const ymd = (iso) => iso.replace(/-/g, "");

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!env.CALENDAR_TOKEN || !(await safeEqual(token, env.CALENDAR_TOKEN))) {
    return new Response("Not found", { status: 404 });
  }
  const { results } = await env.DB.prepare(
    `SELECT * FROM bookings WHERE ${ACTIVE_STATUS_SQL} ORDER BY check_in`
  ).all();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//dbp12//booking//DE",
    "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:DBP12 Belegung",
  ];
  for (const b of results) {
    const summary =
      b.kind === "block"
        ? `Gesperrt${b.note ? ": " + b.note : ""}`
        : `${b.guest_name} (${b.adults}+${b.children}) ${b.payment_method === "cash" ? "bar" : "online"}`;
    const desc =
      b.kind === "block"
        ? b.note || ""
        : `${b.id}\n${b.guest_email}\n${b.guest_phone || ""}\n${(b.amount_cents / 100).toFixed(2)} EUR\n${b.guest_message || ""}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id}@dbp12`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(b.check_in)}`,
      `DTEND;VALUE=DATE:${ymd(b.check_out)}`,
      `SUMMARY:${esc(summary)}`,
      `DESCRIPTION:${esc(desc)}`,
      "TRANSP:OPAQUE",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "no-store" },
  });
}
