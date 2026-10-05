// GET /api/config – öffentliche Einstellungen für das Frontend
import { config } from "../_lib/stay.js";
import { json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  const onlineReady = config.payments.onlineEnabled && !!env.STRIPE_SECRET_KEY;
  return json({
    currency: config.currency,
    pricing: config.pricing,
    stay: config.stay,
    payments: {
      default: config.payments.default,
      onlineEnabled: onlineReady,
      onlineMethods: config.payments.onlineMethods,
    },
    bookingEnabled: !(config.booking && config.booking.enabled === false),
    houseRulesVersion: config.houseRulesVersion,
    property: { name: config.property.name, registrationNumber: config.property.registrationNumber },
    contact: { name: config.contact.hostName, whatsappHandle: config.contact.whatsappHandle || "", email: config.contact.email || "" },
  });
}
