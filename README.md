# DBP12 – Buchungsseite Dora-Benjamin-Park 12

Kleine Buchungsseite für die Wohnung im Dora-Benjamin-Park 12 (Berlin-Stralau), auf Deutsch und Englisch.
Cloudflare Pages liefert die Seite aus, Pages Functions bilden die API, eine Cloudflare-D1-Datenbank speichert Buchungen und Sperrzeiten.

## Was die Seite kann

- DE/EN-Umschalter oben rechts. Alle Texte stehen in `public/i18n/de.json` und `public/i18n/en.json`.
- Fotos, Umgebungsfotos und Grundriss. Welche Bilder gezeigt werden, steht in `public/images/gallery.json`.
- Hausordnung & Mietbedingungen in `public/content/house-rules.de.html` und `.en.html`. Vor der Buchung muss sie per Checkbox akzeptiert werden. Gespeichert werden Zeitpunkt und Fassung (`houseRulesVersion`).
- Kalender mit belegten Tagen. Abreisetag und nächster Anreisetag dürfen gleich sein.
- Preisberechnung nach `site.config.json` (wird im Browser angezeigt und auf dem Server noch einmal berechnet).
- Barzahlung bei Schlüsselübergabe als Standard. Buchung ist sofort verbindlich.
- Karte, SEPA-Lastschrift und PayPal über Stripe Checkout sind eingebaut, aber deaktiviert.
- Bestätigungsmail an den Gast (in seiner Sprache) und Benachrichtigung an dich.
- Verwaltung unter `/admin.html`: Buchungen ansehen, Zeiträume sperren (z. B. Eigennutzung), stornieren.
- iCal-Feed unter `/api/calendar?token=…`, den du in Google Kalender abonnieren kannst.
- Keine Cookies, kein Tracking, keine externen Schriften.

## Einstellungen ändern

Alles Wichtige steht in `site.config.json`:

| Einstellung | Bedeutung |
|---|---|
| `pricing.nightly.low` / `high` | Preise pro Nacht für 1, 2 und 3 Erwachsene in Neben- und Hauptsaison (120/160/190 € und 150/190/220 €) |
| `pricing.highSeason` | Zeiträume der Hauptsaison als Monat-Tag (April bis Oktober, 20.12. bis 2.1.) |
| `pricing.childSurchargePerNight` | Aufschlag pro Kind und Nacht (30 €) |
| `pricing.cleaningFee` | Reinigungspauschale einmalig (50 €) |
| `pricing.cityTaxPercent` | Übernachtungsteuer in Prozent, 0 = nicht ausweisen |
| `stay.minNights` / `maxNights` | 1 bzw. 10 Nächte |
| `stay.maxAdults` / `maxChildren` | 3 / 3 |
| `stay.checkInFrom` usw. | Check-in 15–20 Uhr, Check-out 11 Uhr (nur für E-Mails; in der Hausordnung separat pflegen) |
| `payments.onlineEnabled` | `true` schaltet Stripe frei (zusätzlich `STRIPE_SECRET_KEY` nötig) |
| `houseRulesVersion` | Bei jeder inhaltlichen Änderung der Hausordnung erhöhen |
| `property.registrationNumber` | Registriernummer, erscheint dann im Footer |

Nach jeder Änderung neu deployen.

## Fotos austauschen

1. Neue Bilder in `public/images/gallery/` (Wohnung) bzw. `public/images/area/` (Umgebung) legen. Am besten als JPG oder WebP, etwa 1600 px breit.
2. In `public/images/gallery.json` Pfad und Bildbeschreibung (de/en) eintragen. Die Reihenfolge dort ist die Reihenfolge auf der Seite. `hero` ist das große Bild oben.
3. Die Hinweiszeile unter der Galerie (`flat.photoHint` in den Sprachdateien) anpassen, sobald keine KI-Visualisierungen mehr dabei sind.

## Einrichtung (einmalig)

```
npm install
npx wrangler login
npx wrangler d1 create dbp12
```
Die ausgegebene `database_id` in `wrangler.toml` eintragen, dann:
```
npm run db:remote
npx wrangler pages project create dbp12 --production-branch main
```

Secrets setzen (jeweils wird nach dem Wert gefragt):
```
npx wrangler pages secret put ADMIN_TOKEN       # Passwort für /admin.html
npx wrangler pages secret put HOST_EMAIL        # deine Adresse für Benachrichtigungen
npx wrangler pages secret put RESEND_API_KEY    # E-Mail-Versand
npx wrangler pages secret put CALENDAR_TOKEN    # langer Zufallswert für den iCal-Feed
```
In `wrangler.toml` noch `MAIL_FROM` und `PUBLIC_URL` auf die echte Domain setzen.

Deployen:
```
npm run deploy
```

### E-Mail (Resend)

1. Konto bei resend.com anlegen, die Absender-Domain (z. B. `notmybiz.com` oder `simsab.net`) hinzufügen.
2. Resend zeigt DNS-Einträge (SPF/DKIM). Diese bei GoDaddy eintragen.
3. API-Key erzeugen und als `RESEND_API_KEY` setzen.

Solange kein Key gesetzt ist, werden Mails nur ins Log geschrieben. Buchungen funktionieren trotzdem.

### Domain

In Cloudflare Pages unter *Custom domains* die Subdomain hinzufügen (z. B. `wohnung.simsab.net`). Cloudflare nennt einen CNAME-Eintrag, den du bei GoDaddy anlegst.

### Verwaltung absichern

`/admin.html` ist mit `ADMIN_TOKEN` geschützt. Zusätzlich kannst du in Cloudflare Zero Trust eine Access-Regel für `/admin.html` und `/api/admin/*` anlegen, die nur deine E-Mail-Adresse zulässt (kostenlos bis 50 Nutzer).

### Belegung im Google Kalender sehen

In Google Kalender: *Weitere Kalender → Per URL* und `https://<deine-domain>/api/calendar?token=<CALENDAR_TOKEN>` eintragen. Google aktualisiert abonnierte Kalender nur alle paar Stunden. Der umgekehrte Weg (Belegung aus einem geteilten Google Kalender lesen) ist vorbereitet: Die Verfügbarkeit läuft zentral über `listOccupied()` in `functions/_lib/db.js`, dort kann später ein zweiter Kalender eingelesen werden.

## Online-Zahlung später freischalten

1. In Stripe unter *Settings → Payment methods* Karte, SEPA-Lastschrift und PayPal aktivieren.
2. Webhook unter *Developers → Webhooks* auf `https://<deine-domain>/api/stripe-webhook` anlegen, mit den Ereignissen `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` und `checkout.session.expired`.
3. `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` als Secrets setzen (zuerst Testschlüssel).
4. In `site.config.json` `payments.onlineEnabled` auf `true` setzen und deployen.

Ablauf: Bei Online-Zahlung wird der Zeitraum 35 Minuten reserviert. Erst wenn Stripe die Zahlung meldet, wird die Buchung bestätigt und die Mails gehen raus. Läuft die Zahlung ab oder schlägt sie fehl, wird der Zeitraum wieder frei.

## Lokal entwickeln

Einmalig (Windows-Eingabeaufforderung):
```
npm install
copy .dev.vars.example .dev.vars
```
Danach jedes Mal:
```
npm run dev
```
`npm run dev` legt die lokale Datenbank beim ersten Start automatisch an.
Seite: http://localhost:8788, Verwaltung: http://localhost:8788/admin.html (Passwort aus `.dev.vars`).

## Aufbau

```
site.config.json            Preise, Regeln, Zahlarten
wrangler.toml               Cloudflare-Konfiguration
migrations/                 Datenbankschema (D1)
functions/api/              API-Endpunkte
  config.js                 öffentliche Einstellungen
  availability.js           belegte Zeiträume (ohne Gastdaten)
  bookings.js               Buchung anlegen
  stripe-webhook.js         Zahlungsereignisse
  calendar.js               iCal-Feed
  admin/                    Verwaltung
functions/_lib/             gemeinsame Logik (Preis, DB, Mail, Stripe)
public/                     Website
```

Doppelbuchungen sind ausgeschlossen: Prüfung und Eintrag passieren in einer einzigen Datenbankanweisung.
