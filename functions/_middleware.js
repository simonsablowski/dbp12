// Leitet die alte Adresse dbp12.pages.dev dauerhaft auf die eigene Domain (PUBLIC_URL) um.
// Aktiv nur, wenn REDIRECT_OLD_HOST in wrangler.toml auf "true" steht.
// Die API bleibt unter der alten Adresse erreichbar, damit ein abonnierter Kalender-Feed weiterläuft.
// Vorschau-Adressen (xyz.dbp12.pages.dev) werden nicht umgeleitet.
const OLD_HOST = "dbp12.pages.dev";

export async function onRequest({ request, env, next }) {
  if (env.REDIRECT_OLD_HOST === "true" && env.PUBLIC_URL) {
    const url = new URL(request.url);
    const target = new URL(env.PUBLIC_URL);
    const isPage = request.method === "GET" || request.method === "HEAD";
    if (url.hostname === OLD_HOST && target.hostname !== OLD_HOST && isPage && !url.pathname.startsWith("/api/")) {
      return Response.redirect(target.origin + url.pathname + url.search, 301);
    }
  }
  return next();
}
