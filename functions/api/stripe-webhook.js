// POST /api/stripe-webhook – Zahlungsereignisse von Stripe
import { verifyWebhook } from "../_lib/stripe.js";
import { getBooking, setStatus } from "../_lib/db.js";
import { json, error } from "../_lib/http.js";
import { sendGuestConfirmation, sendHostNotification } from "../_lib/mail.js";

export async function onRequestPost({ request, env, waitUntil }) {
  const payload = await request.text();
  const ok = await verifyWebhook(payload, request.headers.get("stripe-signature"), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) return error("invalid_signature", 400);

  const event = JSON.parse(payload);
  const session = event.data?.object;
  const bookingId = session?.metadata?.booking_id;
  if (!bookingId) return json({ received: true });

  const booking = await getBooking(env.DB, bookingId);
  if (!booking) return json({ received: true });

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (booking.status !== "confirmed") {
        await setStatus(env.DB, bookingId, "confirmed", { holdExpiresAt: null });
        const updated = await getBooking(env.DB, bookingId);
        waitUntil(Promise.all([sendGuestConfirmation(env, updated), sendHostNotification(env, updated)]));
      }
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await setStatus(env.DB, bookingId, "cancelled");
      break;
  }
  return json({ received: true });
}
