-- Buchungen und Sperrzeiten. Datumswerte als YYYY-MM-DD, check_out ist exklusiv
-- (Abreisetag, an dem die nächste Anreise möglich ist).
CREATE TABLE IF NOT EXISTS bookings (
  id               TEXT PRIMARY KEY,           -- z. B. DBP-7K3QX9
  kind             TEXT NOT NULL DEFAULT 'booking' CHECK (kind IN ('booking','block')),
  status           TEXT NOT NULL CHECK (status IN ('confirmed','pending_payment','cancelled')),
  check_in         TEXT NOT NULL,
  check_out        TEXT NOT NULL,
  adults           INTEGER NOT NULL DEFAULT 0,
  children         INTEGER NOT NULL DEFAULT 0,
  guest_name       TEXT,
  guest_email      TEXT,
  guest_phone      TEXT,
  guest_message    TEXT,
  language         TEXT,
  payment_method   TEXT,                       -- cash | card | sepa_debit | paypal
  amount_cents     INTEGER NOT NULL DEFAULT 0,
  price_breakdown  TEXT,                       -- JSON
  rules_version    TEXT,
  rules_accepted_at TEXT,
  stripe_session_id TEXT,
  hold_expires_at  TEXT,                       -- nur bei pending_payment
  note             TEXT,                       -- interne Notiz (z. B. Grund einer Sperrzeit)
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings (check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings (status);
