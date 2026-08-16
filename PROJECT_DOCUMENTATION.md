# iTRUSH / CleanGKMA — Project Documentation

## 1. Summary
A web-based collection-management system for Kampala (GKMA) that connects residents, KCCA officers and collection drivers. The front-end is static HTML/CSS/JS using Leaflet for maps and Firebase (Auth + Firestore) for realtime data and notifications. An optional Node/Express backend exists to provide a Postgres-backed API and additional server-side features.

## 2. Architecture & What Each Piece Does
- Frontend (`app/`): Plain HTML pages for Resident, Driver, and Admin dashboards plus a small JS layer that handles UI, theme toggles, Firebase auth, Firestore subscriptions, map rendering (Leaflet) and notifications.
- Firebase (Auth + Firestore): Primary realtime backend used for auth, notifications and live request data. `app/firebase-config.js` contains the web config.
- Maps: Leaflet + CARTO Voyager tiles (no API key required). Map code builds markers and popups and subscribes to realtime data.
- Optional Backend (`backend/`): Node.js + Express API that connects to a Postgres DB when you need relational persistence, RBAC or server-side logic. Contains routes, DB helper (`src/db.js`), and `schema.sql` for the schema.
- Hosting: The app is designed to be hosted on Firebase Hosting (static) and the optional API can be deployed to any Node host (Heroku, Fly, Railway, VPS).

## 3. Tools Used & Why
- HTML/CSS/Vanilla JS — small surface area, easy to deploy as static site.
- Leaflet — lightweight client-side mapping library; easy to switch tile providers.
- CARTO Voyager tiles — free, attractive basemap without API keys or billing.
- Firebase (Auth + Firestore) — realtime updates, authentication and simple hosting for student projects.
- Node.js + Express + Postgres — optional server if you want SQL features, background jobs, or stronger RBAC.
- npm / Firebase CLI — dependency and deployment tooling.

## 4. How The App Was Created (Stages)
1. Requirements & Design — define roles (resident, driver, KCCA), flows (book collection, assign, track), and map needs.
2. Frontend scaffolding — create responsive HTML pages (`app/*.html`) and base CSS variables for theming.
3. Map integration — add Leaflet, choose CARTO tiles, implement `L.map` initialisation and divIcons for markers.
4. Realtime backend — wire Firebase Auth + Firestore for live state and notifications.
5. Notification UX — add a notifications collection, UI rendering and small helper to create notifications from actions.
6. Backend (optional) — code Express API, SQL schema, and integrate with Postgres for persistence.
7. Testing & mobile fixes — iterate on responsive CSS and Leaflet containment fixes to prevent overflow on mobile.
8. Documentation & deployment — write the guides and prepare `firebase.json` + `firestore.rules`.

## 5. Theme Functionality (How It Works)
- The UI uses CSS variables declared on `:root` for colors and surfaces.
- On first paint the app runs a small script (in each HTML page) to pick a theme:
  - It reads `localStorage.getItem('itrush_theme')`.
  - If none is saved, it falls back to `prefers-color-scheme`.
  - The chosen theme is set on the document element with `document.documentElement.setAttribute('data-theme', theme)`.
- CSS defines a `[data-theme="light"]` block that reassigns the same variables for light mode.
- `toggleTheme()` swaps the attribute and writes the choice to `localStorage` to persist across reloads.

## 6. Fixes & Known UI Responsive Issues (what we changed)
When testing on mobile devices the following issues were observed and addressed:
- Maps overflowing panel (map tiles/controls escaping their parent): solved by adding a Leaflet containment CSS fix (constraining `.leaflet-pane`, ensuring `.map-wrap { max-width:100% }` and forcing tile images not to limit layout with `.leaflet-container img.leaflet-tile { max-width:none !important; }`) and by calling `map.invalidateSize()` in the admin map helper to reflow maps when they become visible.
- Notifications rendering one-word-per-line: fixed by allowing flex children to shrink (`min-width: 0`) on the notification elements so words wrap normally when columns are narrow.
- Content running off the right edge (desktop layout on mobile): fixed by collapsing two-column grids on smaller viewports (`.two-col` -> `grid-template-columns: 1fr;`) and making panels horizontally scrollable when needed.

The recent CSS fixes are in the front-end files under `app/` (responsive and leaflet containment CSS blocks added to the dashboards).

## 7. How To Run The App Locally
Prerequisites: Node.js (>=18), npm, Git. Postgres only required if you use the optional backend.

Frontend (static site):
- Option A — quick local static server (recommended for testing UI):

  ```bash
  # from project root
  npm install -g serve        # if not installed
  serve app -l 5000
  # open http://localhost:5000
  ```

- Option B — Firebase local emulators (recommended when testing Firestore rules + auth):

  ```bash
  npm install -g firebase-tools
  firebase login
  firebase emulators:start --only hosting,firestore,auth
  # open the local hosting URL shown by the emulator
  ```

Backend (optional API using Postgres):

  ```bash
  cd backend
  npm install
  # set DATABASE_URL to your Postgres connection string, e.g.
  # export DATABASE_URL=postgres://user:pass@localhost:5432/itrush
  npm run dev
  # API will run on http://localhost:3000 by default
  ```

Notes:
- Firestore security rules are in `firestore.rules`. Publish them through the Firebase console or CLI before hosting.
- The frontend expects a valid Firebase config in `app/firebase-config.js` (the repo already contains a project config used during development).

## 8. Hosting / Deployment
- Static frontend: Firebase Hosting is recommended. The project already contains `firebase.json` configured to serve the `app/` folder.
- Rules: Publish `firestore.rules` (important — do not host with open/demo rules).
- API: Deploy the `backend/` app to any Node host; set `DATABASE_URL` and `NODE_ENV=production`.

Deploy example (hosting + rules):

```bash
firebase deploy --only hosting,firestore:rules
```

## 9. Database Schema Notes
A `schema.sql` (in the repository root / `backend/`) defines core tables when using Postgres: `users`, `residents`, `collectors`, `kcca_officers`, `collection_requests`, `gps_logs`, `notifications`, `invoices`, `overflow_reports`.

## 10. Testing & Troubleshooting Tips
- Blank or partial maps: ensure CDN endpoints for CARTO and Leaflet are reachable (https requests to cartocdn.com and unpkg.com).
- Notifications not showing: verify Firestore reads and that the current user has a `users/{uid}` doc with the `role` property matching the expected role.
- CORS / API errors: check backend `NODE_ENV` and `DATABASE_URL` and confirm the CORS origin if you host frontend separately.

## 11. Suggested Questions For Final Year Project Panel
(Short bullets you can speak to during the viva)
- What problem does iTRUSH solve and who benefits?
- Why choose Leaflet + CARTO over Google Maps?
- Why use Firebase for realtime rather than polling a SQL API?
- How did you implement role-based access and security for Firestore data?
- How would you scale when city-wide adoption increases to thousands of trucks and requests?
- What are the privacy or security considerations for GPS/location data?
- How does the theme toggle persist and avoid FOUC (flash of wrong theme)?
- Describe the end-to-end flow when a resident creates a booking: what services are involved?
- How would you add payment integration? What would change in your architecture?
- Which parts are client-only and which parts require server trust?

## 12. Next Steps / Extensions
- Add unit/integration tests for backend routes.
- Move more logic to the server (rate-limiting, business rules, invoices generation).
- Add WebSocket or server-sent events for non-Firebase realtime backends.
- Add localization (i18n) and accessibility improvements for the dashboards.

---

If you want, I can: 1) run a quick local static server to open a page and validate CSS changes, 2) patch additional pages (index, admin) to unify responsive behavior, or 3) prepare a short presentation slide outline derived from the Q&A list above.
