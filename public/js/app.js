import { detectLang, setLang, t, lang, fmtMoney, fmtDate } from "./i18n.js";

const $ = (s, r = document) => r.querySelector(s);
const state = {
  config: null,
  gallery: null,
  today: null,
  occupied: new Set(), // belegte Nächte als YYYY-MM-DD
  view: null,          // erster Tag des linken Monats
  start: null,
  end: null,
  busy: false,
};

// ---------- Datumshelfer (alles in UTC, nur Kalendertage) ----------
const toIso = (d) => d.toISOString().slice(0, 10);
const parse = (iso) => new Date(iso + "T00:00:00Z");
const addDays = (iso, n) => { const d = parse(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
const nights = (a, b) => Math.round((parse(b) - parse(a)) / 86400000);
const monthStart = (iso) => iso.slice(0, 8) + "01";
const addMonths = (iso, n) => { const d = parse(monthStart(iso)); d.setUTCMonth(d.getUTCMonth() + n); return toIso(d); };

// ---------- Laden ----------
async function loadJson(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(url);
  return r.json();
}

async function loadAvailability() {
  const data = await loadJson("api/availability");
  state.today = data.today;
  state.occupied = new Set();
  for (const r of data.occupied) {
    for (let d = r.start; d < r.end; d = addDays(d, 1)) state.occupied.add(d);
  }
}

// ---------- Galerie ----------
function renderMedia() {
  const g = state.gallery;
  if (!g) return;
  const l = lang();
  const heroPhoto = (g.hero && g.hero.src ? g.hero : g.photos.find((p) => p.src === g.hero)) || g.photos[0];
  const hero = $("#hero-img");
  if (heroPhoto) { hero.src = heroPhoto.src; hero.alt = heroPhoto.alt[l]; }
  const fill = (box, list) => {
    box.innerHTML = "";
    list.forEach((p, i) => {
      const fig = document.createElement("figure");
      const b = document.createElement("button");
      b.type = "button";
      b.title = p.alt[l];
      if (p.contain) b.classList.add("is-plan");
      const img = document.createElement("img");
      img.src = p.src;
      img.alt = p.alt[l];
      if (i > 0) img.loading = "lazy";
      b.appendChild(img);
      b.addEventListener("click", () => openLightbox(list, i));
      fig.appendChild(b);
      if (p.caption) {
        const cap = document.createElement("figcaption");
        cap.textContent = p.caption[l];
        fig.appendChild(cap);
      }
      box.appendChild(fig);
    });
  };
  fill($("#gallery"), g.photos);
  fill($("#gallery-area"), g.area || []);
}

// Großansicht mit Blättern (Pfeiltasten, Buttons, Wischen)
const lightbox = { list: [], index: 0 };

function showLightboxImage() {
  const { list, index } = lightbox;
  const p = list[index];
  const l = lang();
  const img = $("#lightbox-img");
  img.src = p.src;
  img.alt = p.alt[l];
  img.classList.toggle("is-plan", !!p.contain);
  $("#lightbox-cap").textContent = p.alt[l];
  $("#lightbox-count").textContent = `${index + 1} / ${list.length}`;
  const single = list.length < 2;
  $("#lightbox-prev").hidden = single;
  $("#lightbox-next").hidden = single;
}

function stepLightbox(delta) {
  const n = lightbox.list.length;
  if (n < 2) return;
  lightbox.index = (lightbox.index + delta + n) % n;
  showLightboxImage();
}

function openLightbox(list, index) {
  lightbox.list = list;
  lightbox.index = index;
  showLightboxImage();
  $("#lightbox").showModal();
}

// ---------- Hausordnung ----------
async function openRules() {
  const body = $("#rules-body");
  body.innerHTML = await (await fetch(`content/house-rules.${lang()}.html`)).text();
  $("#rules-version").textContent = t("rules.version", { version: fmtDate(state.config.houseRulesVersion, { day: "numeric", month: "long", year: "numeric" }) });
  $("#rules-dialog").showModal();
  body.scrollTop = 0;
}

// ---------- Kalender ----------
function isFreeNight(d) { return !state.occupied.has(d); }
function horizonEnd() { return addDays(state.today, state.config.stay.bookingHorizonDays); }

function validEnd(d) {
  if (!state.start || state.end) return false;
  const n = nights(state.start, d);
  const { minNights, maxNights } = state.config.stay;
  if (n < minNights || n > maxNights) return false;
  for (let x = state.start; x < d; x = addDays(x, 1)) if (!isFreeNight(x)) return false;
  return true;
}

function validStart(d) {
  return d >= state.today && d <= horizonEnd() && isFreeNight(d);
}

function dayClick(d) {
  if (state.start && !state.end && validEnd(d)) {
    state.end = d;
  } else if (validStart(d)) {
    state.start = d;
    state.end = null;
  }
  renderCalendar();
  renderPrice();
}

function renderCalendar() {
  const l = lang();
  const box = $("#cal-months");
  box.innerHTML = "";
  const dows = [];
  for (let i = 0; i < 7; i++) {
    // 2024-01-01 war ein Montag
    dows.push(new Intl.DateTimeFormat(l === "de" ? "de-DE" : "en-GB", { weekday: "short", timeZone: "UTC" }).format(parse(addDays("2024-01-01", i))));
  }
  const picking = state.start && !state.end;

  for (let m = 0; m < 2; m++) {
    const first = addMonths(state.view, m);
    const wrap = document.createElement("div");
    wrap.className = "cal-month";
    const title = new Intl.DateTimeFormat(l === "de" ? "de-DE" : "en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(parse(first));
    wrap.innerHTML = `<p class="cal-title">${title}</p>`;
    const grid = document.createElement("div");
    grid.className = "cal-grid";
    dows.forEach((d) => { const s = document.createElement("span"); s.className = "cal-dow"; s.textContent = d.replace(".", ""); grid.appendChild(s); });
    const offset = (parse(first).getUTCDay() + 6) % 7;
    for (let i = 0; i < offset; i++) grid.appendChild(document.createElement("span"));
    const nextMonth = addMonths(first, 1);
    for (let d = first; d < nextMonth; d = addDays(d, 1)) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "cal-day";
      b.textContent = String(Number(d.slice(8)));
      b.dataset.date = d;
      const booked = !isFreeNight(d);
      const prevFree = isFreeNight(addDays(d, -1));
      if (booked && prevFree) b.classList.add("is-booked-start");
      else if (booked) b.classList.add("is-booked");
      if (d === state.today) b.classList.add("is-today");
      if (state.start && d === state.start) b.classList.add("is-start");
      if (state.end && d === state.end) b.classList.add("is-end");
      if (state.start && state.end && d > state.start && d < state.end) b.classList.add("in-range");

      const selectable = (picking && validEnd(d)) || validStart(d);
      b.disabled = !selectable && d !== state.start;
      b.setAttribute("aria-label", fmtDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
      if (d === state.start || d === state.end) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", () => dayClick(d));
      grid.appendChild(b);
    }
    wrap.appendChild(grid);
    box.appendChild(wrap);
  }

  $("#cal-prev").disabled = state.view <= monthStart(state.today);
  $("#cal-next").disabled = addMonths(state.view, 1) > monthStart(horizonEnd());

  const status = $("#cal-status");
  if (state.start && state.end) {
    const n = nights(state.start, state.end);
    status.textContent = t("book.selected", {
      from: fmtDate(state.start, { weekday: "short", day: "numeric", month: "short" }),
      to: fmtDate(state.end, { weekday: "short", day: "numeric", month: "short" }),
      nights: n === 1 ? t("book.night") : t("book.nights", { n }),
    });
  } else if (state.start) {
    status.textContent = t("book.pickDeparture");
  } else {
    status.textContent = t("book.pickArrival");
  }
  $("#cal-reset").hidden = !state.start;
  $("#cal-minmax").textContent = t("book.minmax", { min: state.config.stay.minNights, max: state.config.stay.maxNights });
}

// ---------- Preis ----------
function calcPrice() {
  if (!state.start || !state.end) return null;
  const p = state.config.pricing;
  const adults = Number($("#adults").value);
  const children = Number($("#children").value);
  const n = nights(state.start, state.end);
  const base = adults >= 2 ? p.nightlyRateTwoAdults : p.nightlyRateOneAdult;
  const nightly = base + children * p.childSurchargePerNight;
  const accommodation = n * nightly;
  const cityTax = Math.round(accommodation * (p.cityTaxPercent || 0)) / 100;
  return { n, nightly, children, accommodation, cleaning: p.cleaningFee, cityTax, total: accommodation + p.cleaningFee + cityTax };
}

function renderPrice() {
  const box = $("#price-box");
  const cur = state.config.currency;
  const p = state.config.pricing;
  $("#rate-info").textContent = t("price.rateInfo", {
    one: fmtMoney(p.nightlyRateOneAdult, cur),
    two: fmtMoney(p.nightlyRateTwoAdults, cur),
    child: fmtMoney(p.childSurchargePerNight, cur),
    cleaning: fmtMoney(p.cleaningFee, cur),
  });
  const pr = calcPrice();
  if (!pr) {
    box.innerHTML = `<p class="small">${t("price.empty")}</p>`;
    return;
  }
  const lines = [
    `<li><span>${t("price.nightsLabel")} ${t("price.nights", { n: pr.n, rate: fmtMoney(pr.nightly, cur) })}</span><span>${fmtMoney(pr.accommodation, cur)}</span></li>`,
  ];
  if (pr.children) lines.push(`<li class="sub-line"><span>${t("price.childrenLabel", { n: pr.children, rate: fmtMoney(p.childSurchargePerNight, cur) })}</span><span></span></li>`);
  lines.push(`<li><span>${t("price.cleaning")}</span><span>${fmtMoney(pr.cleaning, cur)}</span></li>`);
  if (pr.cityTax) lines.push(`<li><span>${t("price.cityTax", { p: p.cityTaxPercent })}</span><span>${fmtMoney(pr.cityTax, cur)}</span></li>`);
  lines.push(`<li class="total"><span>${t("price.total")}</span><span>${fmtMoney(pr.total, cur)}</span></li>`);
  box.innerHTML = `<p class="price-dates">${fmtDate(state.start)} – ${fmtDate(state.end)}</p><ul class="price-lines">${lines.join("")}</ul>`;
}

// ---------- Formular ----------
function renderGuestSelects() {
  const s = state.config.stay;
  const fill = (sel, from, to) => {
    const v = sel.value;
    sel.innerHTML = "";
    for (let i = from; i <= to; i++) sel.add(new Option(String(i), String(i)));
    if (v) sel.value = v;
  };
  fill($("#adults"), 1, s.maxAdults);
  if (!$("#adults").dataset.init) { $("#adults").value = String(Math.min(2, s.maxAdults)); $("#adults").dataset.init = "1"; }
  fill($("#children"), 0, s.maxChildren);
}

function renderPayments() {
  const box = $("#pay-options");
  const selected = box.querySelector("input:checked")?.value || state.config.payments.default;
  const methods = ["cash", ...state.config.payments.onlineMethods];
  box.innerHTML = "";
  for (const m of methods) {
    const disabled = m !== "cash" && !state.config.payments.onlineEnabled;
    const label = document.createElement("label");
    label.className = "pay" + (disabled ? " is-disabled" : "");
    label.innerHTML = `<input type="radio" name="paymentMethod" value="${m}"><span>${t("form.pay." + m)}</span>${disabled ? `<span class="soon">${t("form.pay.soon")}</span>` : ""}`;
    const input = label.querySelector("input");
    input.disabled = disabled;
    input.checked = m === selected && !disabled;
    input.addEventListener("change", updateSubmitLabel);
    box.appendChild(label);
  }
  if (!box.querySelector("input:checked")) box.querySelector('input[value="cash"]').checked = true;
  updateSubmitLabel();
}

function updateSubmitLabel() {
  const m = $("#pay-options input:checked")?.value;
  $("#submit-btn").textContent = state.busy ? t("form.submitting") : t(m && m !== "cash" ? "form.submitOnline" : "form.submit");
}

function renderAcceptText() {
  const span = $("#accept-rules-text");
  const [before, after] = t("form.acceptRules").split("{link}");
  span.textContent = "";
  span.append(before);
  const a = document.createElement("a");
  a.href = "#rules";
  a.textContent = t("form.rulesLink");
  a.addEventListener("click", (e) => { e.preventDefault(); openRules(); });
  span.append(a, after ?? "");
}

function showError(code) {
  const el = $("#form-error");
  el.textContent = t("err." + code) !== "err." + code ? t("err." + code) : t("err.generic");
  el.hidden = false;
}

async function submit(e) {
  e.preventDefault();
  if (state.busy) return;
  $("#form-error").hidden = true;
  const f = e.target;
  if (!state.start || !state.end) return showError("invalid_dates");
  if (f.name.value.trim().length < 2) return showError("invalid_name");
  if (!f.email.checkValidity() || !f.email.value) return showError("invalid_email");
  if (!f.phone.value.trim()) return showError("invalid_phone");
  if (!f.acceptRules.checked) return showError("rules_not_accepted");

  const payload = {
    checkIn: state.start,
    checkOut: state.end,
    adults: Number(f.adults.value),
    children: Number(f.children.value),
    name: f.name.value,
    email: f.email.value,
    phone: f.phone.value,
    message: f.message.value,
    website: f.website.value,
    paymentMethod: f.paymentMethod.value,
    acceptRules: true,
    rulesVersion: state.config.houseRulesVersion,
    language: lang(),
  };

  state.busy = true;
  $("#submit-btn").disabled = true;
  updateSubmitLabel();
  try {
    const res = await fetch("api/bookings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      showError(data.error || "generic");
      if (data.error === "dates_unavailable") {
        await loadAvailability();
        state.start = state.end = null;
        renderCalendar();
        renderPrice();
      }
      return;
    }
    if (data.checkoutUrl) { location.href = data.checkoutUrl; return; }
    showDone(t("done.title"), t("done.text", { id: data.id, email: payload.email }));
    f.reset();
    $("#adults").value = String(Math.min(2, state.config.stay.maxAdults));
    renderPayments();
    state.start = state.end = null;
    await loadAvailability();
    renderCalendar();
    renderPrice();
  } catch {
    showError("generic");
  } finally {
    state.busy = false;
    $("#submit-btn").disabled = false;
    updateSubmitLabel();
  }
}

function showDone(title, text) {
  const box = $("#booking-done");
  box.innerHTML = "";
  const h = document.createElement("h3"); h.textContent = title;
  const p = document.createElement("p"); p.textContent = text;
  const b = document.createElement("button"); b.type = "button"; b.className = "btn btn-ghost"; b.textContent = t("done.another");
  b.addEventListener("click", () => { box.hidden = true; $("#booking-form").hidden = false; });
  box.append(h, p, b);
  box.hidden = false;
  $("#booking-form").hidden = true;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ---------- Gesamtdarstellung ----------
function renderAll() {
  const c = state.config;
  $("#hero-from").textContent = t("hero.from", { price: fmtMoney(c.pricing.nightlyRateOneAdult, c.currency) });
  const reg = $("#reg-nr");
  if (c.property.registrationNumber) { reg.textContent = t("footer.registration", { nr: c.property.registrationNumber }); reg.hidden = false; }
  const wa = (c.contact && c.contact.whatsappHandle) || "";
  $("#contact-wa").hidden = !wa;
  $("#contact-handle").textContent = wa;
  $("#contact-how").hidden = !wa;
  const mail = (c.contact && c.contact.email) || "";
  $("#contact-mail").hidden = !mail;
  $("#contact-mail-link").textContent = mail;
  $("#contact-mail-link").href = mail ? `mailto:${mail}` : "";
  renderMedia();
  renderGuestSelects();
  renderPayments();
  renderAcceptText();
  renderCalendar();
  renderPrice();
}

async function init() {
  await setLang(detectLang());
  try {
    const [config, gallery] = await Promise.all([loadJson("api/config"), loadJson("images/gallery.json")]);
    state.config = config;
    state.gallery = gallery;
    await loadAvailability();
  } catch {
    $("#cal-status").textContent = t("err.load");
    return;
  }
  state.view = monthStart(state.today);
  renderAll();

  document.querySelectorAll("[data-lang]").forEach((b) =>
    b.addEventListener("click", async () => { await setLang(b.dataset.lang); renderAll(); })
  );
  document.querySelectorAll("[data-open-rules]").forEach((b) => b.addEventListener("click", openRules));
  document.querySelectorAll("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
  $("#lightbox-prev").addEventListener("click", () => stepLightbox(-1));
  $("#lightbox-next").addEventListener("click", () => stepLightbox(1));
  $("#lightbox").addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") { e.preventDefault(); stepLightbox(-1); }
    if (e.key === "ArrowRight") { e.preventDefault(); stepLightbox(1); }
  });
  let touchX = null;
  $("#lightbox").addEventListener("touchstart", (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  $("#lightbox").addEventListener("touchend", (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) stepLightbox(dx < 0 ? 1 : -1);
    touchX = null;
  });
  $("#cal-prev").addEventListener("click", () => { state.view = addMonths(state.view, -1); renderCalendar(); });
  $("#cal-next").addEventListener("click", () => { state.view = addMonths(state.view, 1); renderCalendar(); });
  $("#cal-reset").addEventListener("click", () => { state.start = state.end = null; renderCalendar(); renderPrice(); });
  $("#adults").addEventListener("change", renderPrice);
  $("#children").addEventListener("change", renderPrice);
  $("#booking-form").addEventListener("submit", submit);

  // Rückkehr von Stripe
  const q = new URLSearchParams(location.search);
  if (q.get("booking") && q.get("paid")) showDone(t("done.paidTitle"), t("done.paidText", { id: q.get("booking") }));
  else if (q.get("booking") && q.get("cancelled")) showError("generic"), ($("#form-error").textContent = t("done.cancelledText"));
}

init();
