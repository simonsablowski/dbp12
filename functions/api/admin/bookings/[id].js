// POST /api/admin/bookings/:id  {action: "cancel"}  – Buchung oder Sperrzeit stornieren
import { getBooking, setStatus } from "../../../_lib/db.js";
import { json, error, requireAdmin } from "../../../_lib/http.js";

export async function onRequestPost({ request, env, params }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  const booking = await getBooking(env.DB, params.id);
  if (!booking) return error("not_found", 404);
  if (body.action === "cancel") {
    await setStatus(env.DB, params.id, "cancelled");
    return json({ ok: true });
  }
  return error("unknown_action");
}
