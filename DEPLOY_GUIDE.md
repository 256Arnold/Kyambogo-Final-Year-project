# iTRUSH / CleanGKMA — Firebase & Hosting Guide

This walks you through the two files I generated (`firestore.rules`,
`firebase.json`) and how to publish the security rules and host the app.
Do these in order.

---

## Part 1 — What the new files are for

| File | What it does | Where it goes |
|------|--------------|---------------|
| `firestore.rules` | Role-based security rules (who can read/write what) | Published to Firestore → Rules |
| `firebase.json` | Tells Firebase where the app lives (`app/`) and which rules file to use | Project root (already there) |

You do **not** paste `firebase.json` anywhere — the Firebase CLI reads it.
You **do** publish `firestore.rules` (two ways shown below).

---

## Part 2 — Publish the security rules

You currently have wide-open demo rules. Replace them before hosting.

### Option A — Console (no installs, easiest)

1. Go to <https://console.firebase.google.com> and open your **itrush-9a273** project.
2. Left menu → **Build → Firestore Database → Rules** tab.
3. Delete everything in the editor.
4. Open the `firestore.rules` file I gave you, copy **all** of it, paste it in.
5. Click **Publish**.

That's it — the app is now role-secured.

### Option B — Firebase CLI (better, repeatable)

Run these in the project root (where `firebase.json` is):

```bash
npm install -g firebase-tools      # once
firebase login                     # opens a browser to sign in
firebase use itrush-9a273          # select your project
firebase deploy --only firestore:rules
```

---

## Part 3 — Test that the rules didn't break anything

Because the rules are now role-based, **every account must have a `users`
document with a `role`**. New signups create this automatically. If you made
test accounts under the old rules, they already have it.

Quick smoke test after publishing:

1. Sign in as a **resident** → book a collection. It should save (not throw a
   "Missing or insufficient permissions" error).
2. Sign in as **KCCA** → you should see that booking and be able to assign it.
3. Sign in as the **collector** → the assigned job should appear.

If you get a permissions error, it almost always means that account has no
`users/{uid}` doc with a `role`. Re-create the account through the sign-up
screen (not the Firebase console) so the role is written.

---

## Part 4 — Host the app (do this last, after everything works locally)

Firebase Hosting is the natural fit and is free.

```bash
# in the project root
firebase deploy --only hosting
```

This uploads the `app/` folder (as set in `firebase.json`) and gives you a live
URL like `https://itrush-9a273.web.app`.

To deploy **rules and hosting together**:

```bash
firebase deploy
```

### Before you host — a checklist

- [ ] Security rules published (Part 2) — **do not host with open rules**.
- [ ] `firebase-config.js` has your real project config (it does).
- [ ] You've tested the full flow locally (resident → KCCA → driver).
- [ ] Maps load over HTTPS (they will; CARTO + OpenStreetMap are HTTPS).

---

## Part 5 — About the map provider (reminder)

The app uses **CARTO Voyager** map tiles through Leaflet. These are free, need
**no API key and no credit card**, and work on a hosted site. You do *not* need
Google Maps billing. If an examiner specifically asks for Google Maps, that can
be swapped in later behind your own key — but the current setup is the safe,
zero-cost choice for a hosted student project.

---

## Common issues

| Symptom | Cause | Fix |
|--------|-------|-----|
| "Missing or insufficient permissions" | Account has no `users` doc with a role, or rules not published | Re-create account via sign-up; publish rules |
| Blank map | No internet, or CDN blocked | Maps need to reach `cartocdn.com` + `unpkg.com` |
| `firebase: command not found` | CLI not installed | `npm install -g firebase-tools` |
| Deploy uploads wrong folder | `firebase.json` `public` value | It's set to `app` — leave it |
