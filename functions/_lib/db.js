// Datenbankzugriff (Cloudflare D1)

export const ACTIVE_STATUS_SQL = `(status = 'confirmed' OR (status = 'pending_payment' AND hold_expires_at > strftime('%Y-%m-%dT%H:%M:%SZ','now')))`;

// Alle belegten Zeiträume ab einem Datum (ohne persönliche Daten)
export async function listOccupied(db, fromDate) {
  const { results } = await db
    .prepare(
      `SELECT check_in, check_out FROM bookings
       WHERE ${ACTIVE_STATUS_SQL} AND check_out > ?1
       ORDER BY check_in`
    )
    .bind(fromDate)
    .all();
  return results.map((r) => ({ start: r.check_in, end: r.check_out }));
}

// Legt eine Buchung nur an, wenn sich der Zeitraum mit keiner aktiven
// Buchung oder Sperrzeit überschneidet. Prüfung und Einfügen passieren in
// einer einzigen SQL-Anweisung, damit zwei gleichzeitige Anfragen nicht
// denselben Zeitraum bekommen.
export async function insertIfFree(db, b) {
  const res = await db
    .prepare(
      `INSERT INTO bookings (id, kind, status, check_in, check_out, adults, children,
         guest_name, guest_email, guest_phone, guest_message, language, payment_method,
         amount_cents, price_breakdown, rules_version, rules_accepted_at, hold_expires_at, note)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19
       WHERE NOT EXISTS (
         SELECT 1 FROM bookings
         WHERE ${ACTIVE_STATUS_SQL} AND check_in < ?5 AND check_out > ?4
       )`
    )
    .bind(
      b.id, b.kind, b.status, b.checkIn, b.checkOut, b.adults ?? 0, b.children ?? 0,
      b.guestName ?? null, b.guestEmail ?? null, b.guestPhone ?? null, b.guestMessage ?? null,
      b.language ?? null, b.paymentMethod ?? null, b.amountCents ?? 0,
      b.priceBreakdown ? JSON.stringify(b.priceBreakdown) : null,
      b.rulesVersion ?? null, b.rulesAcceptedAt ?? null, b.holdExpiresAt ?? null, b.note ?? null
    )
    .run();
  return res.meta.changes === 1;
}

export async function getBooking(db, id) {
  return db.prepare(`SELECT * FROM bookings WHERE id = ?1`).bind(id).first();
}

export async function setStatus(db, id, status, extra = {}) {
  const sets = ["status = ?2", "updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')"];
  const vals = [id, status];
  if ("stripeSessionId" in extra) {
    vals.push(extra.stripeSessionId);
    sets.push(`stripe_session_id = ?${vals.length}`);
  }
  if ("holdExpiresAt" in extra) {
    vals.push(extra.holdExpiresAt);
    sets.push(`hold_expires_at = ?${vals.length}`);
  }
  await db.prepare(`UPDATE bookings SET ${sets.join(", ")} WHERE id = ?1`).bind(...vals).run();
}

// Gut lesbare, eindeutige Buchungsnummer ohne verwechselbare Zeichen
export function newBookingId(prefix = "DBP") {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `${prefix}-${s}`;
}
