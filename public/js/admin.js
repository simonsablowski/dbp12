// Verwaltung: Buchungen ansehen, Zeiträume sperren, stornieren.
// Das Passwort bleibt nur für diese Browsersitzung gespeichert.
const $ = (s) => document.querySelector(s);
let token = "";
try { token = sessionStorage.getItem("dbp12-admin") || ""; } catch { /* egal */ }

const STATUS = { confirmed: "bestätigt", pending_payment: "Zahlung offen", cancelled: "storniert" };
const PAY = { cash: "bar", card: "Karte", sepa_debit: "SEPA", paypal: "PayPal" };
const money = (c) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(c / 100);
const date = (iso) => new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(iso + "T00:00:00Z"));

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { "content-type": "application/json", authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error("Passwort falsch"); }
  if (!res.ok || data.ok === false) throw new Error(data.error || `Fehler ${res.status}`);
  return data;
}

function cell(text) { const td = document.createElement("td"); td.textContent = text ?? ""; return td; }

async function load() {
  const all = $("#show-all").checked;
  const { bookings } = await api(`api/admin/bookings${all ? "?all=1" : ""}`);
  const tbody = $("#rows");
  tbody.innerHTML = "";
  for (const b of bookings) {
    if (!all && b.status === "cancelled") continue;
    const tr = document.createElement("tr");
    tr.className = `is-${b.status}${b.kind === "block" ? " is-block" : ""}`;
    tr.append(cell(b.id));
    const st = document.createElement("td");
    st.innerHTML = `<span class="badge ${b.status}"></span>`;
    st.firstChild.textContent = b.kind === "block" ? "gesperrt" : STATUS[b.status];
    tr.append(st, cell(date(b.check_in)), cell(date(b.check_out)));
    if (b.kind === "block") {
      tr.append(cell("–"), cell("–"), cell("–"), cell("–"), cell(b.note || ""));
    } else {
      const g = document.createElement("td");
      g.append(b.guest_name || "", document.createElement("br"));
      const a = document.createElement("a"); a.href = `mailto:${b.guest_email}`; a.textContent = b.guest_email;
      g.append(a, document.createElement("br"), b.guest_phone || "");
      tr.append(g, cell(`${b.adults} Erw., ${b.children} Ki.`), cell(money(b.amount_cents)), cell(PAY[b.payment_method] || b.payment_method), cell(b.guest_message || ""));
    }
    const act = document.createElement("td");
    if (b.status !== "cancelled") {
      const btn = document.createElement("button");
      btn.type = "button"; btn.className = "linkish"; btn.textContent = "stornieren";
      btn.addEventListener("click", async () => {
        if (!confirm(`${b.id} (${date(b.check_in)} bis ${date(b.check_out)}) wirklich stornieren?`)) return;
        await api(`api/admin/bookings/${encodeURIComponent(b.id)}`, { method: "POST", body: JSON.stringify({ action: "cancel" }) });
        load();
      });
      act.append(btn);
    }
    tr.append(act);
    tbody.append(tr);
  }
  if (!tbody.children.length) tbody.innerHTML = `<tr><td colspan="10">Keine Einträge.</td></tr>`;
}

function show(loggedIn) {
  $("#login").hidden = loggedIn;
  $("#panel").hidden = !loggedIn;
  $("#logout").hidden = !loggedIn;
}

function logout() {
  token = "";
  try { sessionStorage.removeItem("dbp12-admin"); } catch { /* egal */ }
  show(false);
}

$("#login").addEventListener("submit", async (e) => {
  e.preventDefault();
  token = $("#token").value;
  try {
    await load();
    try { sessionStorage.setItem("dbp12-admin", token); } catch { /* egal */ }
    show(true);
  } catch (err) {
    $("#login-error").textContent = err.message === "admin_not_configured" ? "ADMIN_TOKEN ist noch nicht gesetzt." : "Anmeldung fehlgeschlagen.";
    $("#login-error").hidden = false;
  }
});

$("#logout").addEventListener("click", logout);
$("#show-all").addEventListener("change", load);

$("#block-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#panel-error").hidden = true;
  try {
    await api("api/admin/bookings", { method: "POST", body: JSON.stringify({ checkIn: $("#b-from").value, checkOut: $("#b-to").value, note: $("#b-note").value }) });
    e.target.reset();
    load();
  } catch (err) {
    $("#panel-error").textContent = err.message === "dates_unavailable" ? "Der Zeitraum überschneidet sich mit einer Buchung oder Sperrzeit." : "Konnte nicht gespeichert werden: " + err.message;
    $("#panel-error").hidden = false;
  }
});

if (token) load().then(() => show(true)).catch(() => show(false));
