// POST /api/bookings – verbindliche Buchung anlegen
import { config, validateStay, calculatePrice } from "../_lib/stay.js";
import { insertIfFree, getBooking, newBookingId } from "../_lib/db.js";
import { json, error, clean, isEmail } from "../_lib/http.js";
import { sendGuestConfirmation, sendHostNotification } from "../_lib/mail.js";
import { createCheckoutSession } from "../_lib/stripe.js";

export async function onRequestPost({ request, env, waitUntil }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return error("invalid_json");
  }

  // Honeypot gegen einfache Spam-Bots: das Feld ist für Menschen unsichtbar
  if (body.website) return error("rejected");

  // Buchungen gesperrt (site.config.json: booking.enabled)
  if (config.booking && config.booking.enabled === false) return error("booking_closed", 403);

  const stay = {
    checkIn: body.checkIn,
    checkOut: body.checkOut,
    adults: Number(body.adults),
    children: Number(body.children || 0),
  };
  const stayError = validateStay(stay);
  if (stayError) return error(stayError);

  const guestName = clean(body.name, 120);
  const guestEmail = clean(body.email, 254).toLowerCase();
  const guestPhone = clean(body.phone, 40);
  const guestMessage = clean(body.message, 2000);
  const language = body.language === "en" ? "en" : "de";
  if (guestName.length < 2) return error("invalid_name");
  if (!isEmail(guestEmail)) return error("invalid_email");
  if (!guestPhone) return error("invalid_phone");

  if (body.acceptRules !== true || body.rulesVersion !== config.houseRulesVersion) {
    return error("rules_not_accepted");
  }

  const method = body.paymentMethod || "cash";
  const onlineReady = config.payments.onlineEnabled && !!env.STRIPE_SECRET_KEY;
  if (method !== "cash") {
    if (!config.payments.onlineMethods.includes(method)) return error("invalid_payment_method");
    if (!onlineReady) return error("online_payment_disabled");
  }

  const price = calculatePrice(stay);
  const id = newBookingId();
  const now = new Date();
  const holdExpiresAt =
    method === "cash"
      ? null
      : new Date(now.getTime() + config.payments.pendingPaymentHoldMinutes * 60000).toISOString().replace(/\.\d{3}Z$/, "Z");

  const inserted = await insertIfFree(env.DB, {
    id,
    kind: "booking",
    status: method === "cash" ? "confirmed" : "pending_payment",
    ...stay,
    guestName,
    guestEmail,
    guestPhone,
    guestMessage,
    language,
    paymentMethod: method,
    amountCents: price.totalCents,
    priceBreakdown: price,
    rulesVersion: config.houseRulesVersion,
    rulesAcceptedAt: now.toISOString(),
    holdExpiresAt,
  });
  if (!inserted) return error("dates_unavailable", 409);

  const booking = await getBooking(env.DB, id);

  if (method === "cash") {
    waitUntil(Promise.all([sendGuestConfirmation(env, booking), sendHostNotification(env, booking)]));
    return json({ ok: true, id, status: "confirmed", price });
  }

  // Online-Zahlung: Stripe Checkout starten. Bestätigung kommt per Webhook.
  const session = await createCheckoutSession(env, booking, method);
  if (!session.ok) return error("payment_init_failed", 502);
  return json({ ok: true, id, status: "pending_payment", checkoutUrl: session.url, price });
}
