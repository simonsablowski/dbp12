// GET /api/availability – belegte Zeiträume (nur Datum, keine Gastdaten)
import { listOccupied } from "../_lib/db.js";
import { todayBerlin } from "../_lib/stay.js";
import { json } from "../_lib/http.js";

export async function onRequestGet({ env }) {
  const occupied = await listOccupied(env.DB, todayBerlin());
  return json({ today: todayBerlin(), occupied });
}
