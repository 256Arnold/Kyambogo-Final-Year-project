# Step-by-step guide: Get the iTRUSH app running

The app uses **Firebase** for authentication and data. You do not run a separate database or Node backend for the standard setup: you need a Firebase project, a way to serve the static `app` folder over HTTP, and a modern browser.

---

## New machine: get the computer ready

Use this checklist when you open the project on a laptop or PC for the first time.

### 1. Get the project on the machine

- **With Git:** Install [Git](https://git-scm.com/downloads) if it is not already installed. Clone the repository into a folder you can find easily (example paths below are placeholders—use your real clone path).

  ```bash
  git clone <repository-url>
  cd <folder-name>
  ```

- **Without Git:** Copy the project folder (ZIP or USB) to the machine and open a terminal in that folder. The **project root** is the directory that contains the `app` and `backend` folders; you will run commands from there or from `app` as described later.

### 2. Install something that can serve static files

The app must be opened via **http://localhost** (not `file:///...`). Pick **one** of these:

| Tool | Install | Typical use |
|------|---------|-------------|
| **Python 3** | [python.org](https://www.python.org/downloads/) (check “Add Python to PATH” on Windows) | From project root: `cd app` then `python -m http.server 5000` or `python3 -m http.server 5000` |
| **Node.js** | [nodejs.org](https://nodejs.org/) LTS | From project root: `npx serve app -l 5000` |

You do **not** need PostgreSQL, Docker, or the `backend` folder for this Firebase-only workflow.

### 3. Browser

Use a current **Chrome**, **Firefox**, or **Edge** (or similar). Enable JavaScript (default).

### 4. Firebase account

You will need a free Google account to use the [Firebase Console](https://console.firebase.google.com/). Project creation and config are covered in the next section.

### 5. Before you run the app

1. Complete **Firebase setup** below (project, Auth, Firestore, rules) **and** paste your config into `app/firebase-config.js`.
2. From the project root, start a static server (see **Serve the frontend and open the app**).
3. Open **http://localhost:5000** (or the port your tool prints).

If sign-in or Firestore fails, check the browser console (F12 → Console) and that `firebase-config.js` matches the Firebase project you created.

---

## Firebase setup

**You need:** A Firebase project and a modern browser. No database server or Node backend is required for auth and the main app flow.

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) and sign in.
2. Click **Add project** (or use an existing one). Name it (e.g. `itrush-app`). Disable Google Analytics if you do not need it.
3. Once the project is ready, go to **Project settings** (gear icon) → **Your apps** → click the **Web** icon (`</>`).
4. Register the app with a nickname (e.g. `iTRUSH Web`). Copy the `firebaseConfig` object.

### 2. Enable Authentication and Firestore

1. In the left menu go to **Build** → **Authentication** → **Get started** → **Sign-in method**.
2. Enable **Email/Password** (first provider).
3. Go to **Build** → **Firestore Database** → **Create database** → start in **test mode** (or production with rules below). Pick a region.
4. In **Firestore** → **Rules**, use rules that allow signed-in users to read/write their own profile and allow the app to create bookings and notifications.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function userRole(uid) {
      return get(/databases/$(database)/documents/users/$(uid)).data.role;
    }

    function isKccaOfficer() {
      return request.auth != null &&
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        userRole(request.auth.uid) == 'kcca_officer';
    }

    // Own profile; KCCA officers can read any user (assign drivers, approve collectors) and update approval fields
    match /users/{userId} {
      allow read: if request.auth != null && (
        request.auth.uid == userId || isKccaOfficer()
      );
      allow create: if request.auth != null && request.auth.uid == userId;
      allow update: if request.auth != null && (
        request.auth.uid == userId ||
        isKccaOfficer()
      );
    }

    // Prototype rules for iTRUSH (Firebase-only mode)
    match /collection_requests/{requestId} {
      allow read, write: if request.auth != null;
    }
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

**Important:** Publish these rules so the **KCCA dashboard can list collectors** and **approve driver accounts**. Without `isKccaOfficer()` read access on `users`, driver assignment dropdowns stay empty.

Click **Publish**.

### 3. Add your config to the app

1. Open **`app/firebase-config.js`** in the project.
2. Replace the placeholder values with your Firebase config (same keys: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`).

Example (use your own values):

```javascript
window.ITRUSH_FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc..."
};
```

### 4. Serve the frontend and open the app

From the **project root**:

```bash
cd app
python -m http.server 5000
```

On macOS or Linux, if `python` is not found, try `python3 -m http.server 5000`.

Or, from the project root without changing directory:

```bash
npx serve app -l 5000
```

Open **http://localhost:5000** in your browser. Go to the sign-in page → **Create account** → choose role, fill the form, and sign up.

---

## Using the app in the browser

1. Go to **http://localhost:5000** (use the URL your server prints if the port differs).
2. You should see the **iTRUSH landing page**. If you see a directory list of folders instead, you are serving the wrong folder—go back and run the server so the **document root** is the `app` folder (e.g. `cd app` before starting Python).
3. Ensure **`app/firebase-config.js`** has your real Firebase config.
4. Click **“Request Collection”**, **“Book a Collection”**, or **“Request Pickup”** to reach the **sign-in** page.
5. **Create an account:** open the **“Create account”** tab, choose **Resident**, **KCCA**, or **Collector**, fill required fields (password at least 8 characters), and submit. If nothing happens, open the browser console (F12 → Console) for errors.
6. After sign-up you are redirected by role: **Resident** → resident dashboard, **KCCA** → admin dashboard, **Collector** → driver app.
7. To sign in later, use email and password on the sign-in page.

---

## Run all three roles at the same time (Resident, KCCA, Collector)

Firebase Auth keeps **one signed-in user per site** in the browser. If you open three tabs to **the same URL** (for example `http://localhost:5000`), they all use **the same account**—signing in as the driver will replace the session the resident was using.

To test **three different users together**, use **separate storage** for each role. Any of these approaches works:

### Option 1 — Different browser profiles (one server, one port)

Keep a single static server on port 5000. Create **three browser profiles** (or three “people” in Chrome/Edge), open **http://localhost:5000** in each profile, and sign in with a different role in each (Resident in profile A, KCCA in profile B, Collector in profile C).

**Chrome / Edge:** Profile icon (top right) → **Add** (or **Manage profiles** → **Add profile**).

**Firefox:** about:profiles → **Create a New Profile**, then launch a window with that profile.

Each profile has its own cookies and local storage, so the three sessions stay independent.

### Option 2 — Different browsers

Run one server on port 5000. Use three different browsers (e.g. Chrome, Edge, Firefox), each signed in as a different role on **http://localhost:5000**.

### Option 3 — Different ports (three origins)

Browsers treat `http://localhost:5000`, `http://localhost:5001`, and `http://localhost:5002` as **different sites**, so each can hold its own Firebase login. Start three servers from the **`app`** folder in three terminals:

```bash
# Terminal 1
cd app
python -m http.server 5000

# Terminal 2
cd app
python -m http.server 5001

# Terminal 3
cd app
python -m http.server 5002
```

Or with Node from the **project root**:

```bash
npx serve app -l 5000
npx serve app -l 5001
npx serve app -l 5002
```

Then open **http://localhost:5000** as the resident, **http://localhost:5001** as KCCA, and **http://localhost:5002** as the collector (each in a normal window or tab—the sessions do not overwrite each other).

Create **three accounts** in Firebase (one per role) with **different email addresses** before testing workflows between them.

---

## Quick reference: one terminal (Firebase)

From the **project root**:

```bash
cd app
python -m http.server 5000
```

Or: `npx serve app -l 5000` from the project root.

Then open **http://localhost:5000**.

**Three roles on one machine:** serve `app` on ports **5000**, **5001**, and **5002** (three terminals), or use three browser profiles on one port—see **Run all three roles at the same time** above.

---

## Troubleshooting

- **Sign-in or Firestore errors**  
  Check **Authentication** (Email/Password enabled) and **Firestore** rules in the Firebase Console. Confirm `app/firebase-config.js` matches this project.

- **CORS or blank page**  
  Open the app via **http://localhost:...**, not by double-clicking `index.html` (`file:///...`).

- **Port already in use**  
  Use another port, e.g. `python -m http.server 5001` and open **http://localhost:5001**, or `npx serve app -l 5001`.
