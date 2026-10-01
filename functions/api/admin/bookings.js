// /api/admin/bookings
//   GET  ?all=1        Liste (Standard: ab heute; mit all=1 auch vergangene)
//   POST {checkIn, checkOut, note}   Sperrzeit anlegen (z. B. Eigennutzung)
import { insertIfFree, newBookingId } from "../../_lib/db.js";
import { isIsoDate, nightsBetween, todayBerlin } from "../../_lib/stay.js";
import { json, error, requireAdmin, clean } from "../../_lib/http.js";

export async function onRequestGet({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const all = new URL(request.url).searchParams.get("all") === "1";
  const stmt = all
    ? env.DB.prepare(`SELECT * FROM bookings ORDER BY check_in DESC LIMIT 500`)
    : env.DB.prepare(`SELECT * FROM bookings WHERE check_out >= ?1 ORDER BY check_in ASC`).bind(todayBerlin());
  const { results } = await stmt.all();
  return json({ ok: true, bookings: results });
}

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const { checkIn, checkOut } = body;
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut) || nightsBetween(checkIn, checkOut) < 1) return error("invalid_dates");
  const id = newBookingId("BLK");
  const ok = await insertIfFree(env.DB, {
    id,
    kind: "block",
    status: "confirmed",
    checkIn,
    checkOut,
    note: clean(body.note, 300) || null,
  });
  if (!ok) return error("dates_unavailable", 409);
  return json({ ok: true, id });
}
