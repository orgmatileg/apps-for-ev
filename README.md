# Kalkulator kWh Charging EV (v1)

Pure client-side static web app (PWA-ready) to estimate charging energy (kWh) for electric **cars** and **motorcycles**. Indonesian UI. Manual input only — no OBD, API, or backend.

## App root

```
/workspace/apps-for-ev/
```

## Open locally

Serve the folder over HTTP (required for clipboard + service worker on modern browsers):

```bash
cd /workspace/apps-for-ev
python3 -m http.server 8080
```

Then open: [http://127.0.0.1:8080/](http://127.0.0.1:8080/)

Alternatives:

```bash
npx --yes serve -l 8080 .
# or
php -S 127.0.0.1:8080
```

Opening `index.html` via `file://` works for the calculator logic, but clipboard and the service worker may be restricted.

## Hand to DevOps (static deploy)

Deploy the **entire directory** as static assets. No build step.

| Item | Value |
|------|--------|
| Document root | contents of `/workspace/apps-for-ev/` |
| Entry | `index.html` |
| SPA rewrite | not required (single page) |
| HTTPS | recommended (PWA / SW / clipboard) |
| Cache | HTML short TTL; CSS/JS fingerprinted or short TTL; SW will cache shell |

Key files to publish:

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `icons/` (`icon.svg`, `icon-192.png`, `icon-512.png`)
- `README.md` (optional on CDN)

Ensure `Content-Type` for `manifest.webmanifest` is `application/manifest+json` (or `application/json`) if your CDN does not infer it.

## Product lock

- Input: manual only
- Audience: mobil + motor
- Result: 1 decimal place (e.g. `12.3 kWh`)
- Language: Indonesian labels

## Calculation

```
kWh = capacity_kWh * (target_pct - current_pct) / 100
if loss toggle ON: kWh *= 1.1
display = kWh.toFixed(1)
```

- Default **% target** = `80`
- Default **% sekarang** = `20`
- Default capacity = first mobil preset (`40`)
- If `current >= target`: result disabled + message
- Invalid inputs: result disabled + field validation messages

## Screen

1. Toggle Mobil / Motor → capacity presets (mobil: 40 / 60 / 75; motor: 2 / 3.5 / 5)
2. Kapasitas usable (kWh) + hint
3. % sekarang / % target
4. Toggle loss ~10%
5. Large result + **Salin** (clipboard)

## Acceptance checklist

- [x] Mobil / Motor toggle switches presets
- [x] Preset chips fill capacity field
- [x] Usable capacity hint shown
- [x] Default target 80
- [x] Loss × 1.1 when toggle ON
- [x] Display 1 decimal
- [x] Salin copies `"X.X kWh"`
- [x] Edge: current ≥ target → disabled + message
- [x] Edge: empty / ≤0 capacity / % outside 0–100 / non-numeric → validation
- [x] Manifest + service worker stub for PWA static hosting
