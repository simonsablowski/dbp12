# DBP12 – Dora-Benjamin-Park 12

Vorstellungsseite für die möblierte Wohnung im Dora-Benjamin-Park 12 (Berlin-Stralau), auf Deutsch und Englisch.
Vermietet wird mittel- bis längerfristig (etwa 2 bis 6 Monate) an Unternehmen und deren Beschäftigte, nicht als Ferienwohnung. Die Seite zeigt die Wohnung und bietet eine Kontaktmöglichkeit per E-Mail (contact@simsab.net) und optional WhatsApp. Es gibt weder Buchung noch Preise.

Die Seite ist statisch (Cloudflare Pages, `public/`). Einzige Funktion: `functions/_middleware.js` leitet `dbp12.pages.dev` auf `dbp12.simsab.net` um. Keine Cookies, kein Tracking, keine Datenbank, keine Secrets.

## Inhalte ändern

- Texte: `public/i18n/de.json` und `public/i18n/en.json` (immer beide Dateien pflegen, gleiche Schlüssel).
- Aufbau: `public/index.html`. Impressum und Datenschutz: `public/legal.html` (nur Deutsch).
- Kontaktdaten stehen direkt in `public/index.html` und `public/legal.html`.
- Fotos: Bilder in `public/images/gallery/` bzw. `public/images/area/` ablegen und in `public/images/gallery.json` eintragen (Reihenfolge = Reihenfolge auf der Seite, `hero` = großes Bild oben).
- **Fotos zum Austauschen** sind in `gallery.json` mit `_replace` markiert. Aktuell: `images/gallery/ausziehbett.webp` (zeigt Ausziehbett und Kommode, die entfernt werden; neues Foto z. B. mit Schreibtisch und Schreibtischstuhl).

## Lokal entwickeln und veröffentlichen

```
npm install
npm run dev      # http://localhost:8788
npm run deploy   # veröffentlicht in die Produktionsumgebung (--branch=production)
```

Domain: `dbp12.simsab.net` (Cloudflare Pages, Custom domain, CNAME `dbp12` → `dbp12.pages.dev` bei GoDaddy).

## Git

Repository `simonsablowski/dbp12`. Commit-Nachrichten auf Englisch, kurz und im Imperativ, zum Beispiel `Update flat description`.
