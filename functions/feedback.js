// GET /feedback – Ziel des QR-Codes auf dem Infoblatt.
// Leitet zum Feedback-Formular aus site.config.json (feedback.formUrl) weiter.
// So bleibt das gedruckte Infoblatt gültig, auch wenn das Formular später ausgetauscht wird.
import { config } from "./_lib/stay.js";

export async function onRequestGet({ request }) {
  const target = (config.feedback && config.feedback.formUrl) || new URL("/#contact", request.url).toString();
  return new Response(null, { status: 302, headers: { location: target, "cache-control": "no-store" } });
}
