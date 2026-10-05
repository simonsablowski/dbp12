// Datums- und Preislogik. Wird vom Backend verwendet; das Frontend rechnet
// zur Anzeige mit derselben Formel, maßgeblich ist aber immer der Server.
import config from "../../site.config.json";

export { config };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(s) {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso, n) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function nightsBetween(checkIn, checkOut) {
  const a = Date.parse(checkIn + "T00:00:00Z");
  const b = Date.parse(checkOut + "T00:00:00Z");
  return Math.round((b - a) / 86400000);
}

// Heutiges Datum in Berlin (für "keine Buchung in der Vergangenheit")
export function todayBerlin() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
}

export function validateStay({ checkIn, checkOut, adults, children }) {
  const s = config.stay;
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return "invalid_dates";
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < s.minNights) return "too_short";
  if (nights > s.maxNights) return "too_long";
  if (checkIn < todayBerlin()) return "in_past";
  if (checkIn > addDays(todayBerlin(), s.bookingHorizonDays)) return "too_far";
  if (!Number.isInteger(adults) || adults < 1 || adults > s.maxAdults) return "invalid_adults";
  if (!Number.isInteger(children) || children < 0 || children > s.maxChildren) return "invalid_children";
  return null;
}

// Hauptsaison laut site.config.json (Zeiträume als Monat-Tag, auch über den Jahreswechsel)
export function isHighSeason(iso) {
  const md = iso.slice(5);
  return (config.pricing.highSeason || []).some((r) =>
    r.from <= r.to ? md >= r.from && md <= r.to : md >= r.from || md <= r.to
  );
}

export function calculatePrice({ checkIn, checkOut, adults, children }) {
  const p = config.pricing;
  const idx = Math.min(adults, p.nightly.low.length) - 1;
  const nightlyChildren = children * p.childSurchargePerNight;
  let lowNights = 0;
  let highNights = 0;
  // jede Nacht zählt nach der Saison ihres Datums
  for (let d = checkIn; d < checkOut; d = addDays(d, 1)) {
    if (isHighSeason(d)) highNights++;
    else lowNights++;
  }
  const rateLow = p.nightly.low[idx] + nightlyChildren;
  const rateHigh = p.nightly.high[idx] + nightlyChildren;
  const accommodation = lowNights * rateLow + highNights * rateHigh;
  const cityTax = Math.round(accommodation * (p.cityTaxPercent || 0)) / 100;
  const total = accommodation + p.cleaningFee + cityTax;
  return {
    nights: lowNights + highNights,
    lowNights,
    highNights,
    rateLow,
    rateHigh,
    nightlyChildren,
    accommodation,
    cleaningFee: p.cleaningFee,
    cityTaxPercent: p.cityTaxPercent || 0,
    cityTax,
    total,
    totalCents: Math.round(total * 100),
    currency: config.currency,
  };
}
