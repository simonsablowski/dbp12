// Stripe-Anbindung ohne SDK (direkt über die REST-API, läuft so in Workers).
// Wird erst aktiv, wenn in site.config.json payments.onlineEnabled = true ist
// und STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET als Secrets hinterlegt sind.
//
// Hinweis: PayPal und SEPA-Lastschrift müssen im Stripe-Dashboard unter
// Settings → Payment methods aktiviert sein. SEPA-Lastschriften sind erst
// nach einigen Tagen endgültig; die Buchung wird deshalb schon bestätigt,
// sobald Stripe die Zahlung angenommen hat (checkout.session.completed),
// und bei einem späteren Fehlschlag (async_payment_failed) storniert.

function form(obj, prefix = "", out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (typeof v === "object") form(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function createCheckoutSession(env, booking, method) {
  const lang = booking.language === "en" ? "en" : "de";
  const params = {
    mode: "payment",
    locale: lang,
    customer_email: booking.guest_email,
    client_reference_id: booking.id,
    payment_method_types: { 0: method },
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: booking.amount_cents,
          product_data: {
            name: `Dora-Benjamin-Park 12: ${booking.check_in} – ${booking.check_out}`,
          },
        },
      },
    },
    metadata: { booking_id: booking.id },
    // Stripe verlangt mindestens 30 Minuten
    expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    success_url: `${env.PUBLIC_URL}/?lang=${lang}&booking=${booking.id}&paid=1#book`,
    cancel_url: `${env.PUBLIC_URL}/?lang=${lang}&booking=${booking.id}&cancelled=1#book`,
  };
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form(params),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error("[stripe] session failed", data?.error?.message);
    return { ok: false };
  }
  await env.DB.prepare(`UPDATE bookings SET stripe_session_id = ?2 WHERE id = ?1`).bind(booking.id, data.id).run();
  return { ok: true, url: data.url, id: data.id };
}

// Prüft die Stripe-Signatur (Header "Stripe-Signature") mit HMAC-SHA256
export async function verifyWebhook(payload, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i), p.slice(i + 1)];
    })
  );
  const signatures = header
    .split(",")
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return signatures.some((s) => s.length === expected.length && timingSafe(s, expected));
}

function timingSafe(a, b) {
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
