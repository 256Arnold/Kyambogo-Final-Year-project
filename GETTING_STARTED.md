# Step-by-step guide: Get the iTRUSH app running

You can run the app in two ways:

- **Option A — Firebase** (recommended): No PostgreSQL or backend. Sign-up and sign-in work with just a Firebase project and the frontend.
- **Option B — PostgreSQL + backend**: Full control with your own database and API.

---

## Option A: Use Firebase (no PostgreSQL or backend)

**You need:** A Firebase project and a modern browser. No database or Node backend required for auth.

### 1. Create a Firebase project

1. Go to [Firebase Console](https://console.firebase.google.com/) and sign in.
2. Click **Add project** (or use an existing one). Name it (e.g. `itrush-app`). Disable Google Analytics if you don’t need it.
3. Once the project is ready, go to **Project settings** (gear icon) → **Your apps** → click the **Web** icon (`</>`).
4. Register the app with a nickname (e.g. `iTRUSH Web`). Copy the `firebaseConfig` object.

### 2. Enable Authentication and Firestore

1. In the left menu go to **Build** → **Authentication** → **Get started** → **Sign-in method**.
2. Enable **Email/Password** (first provider).
3. Go to **Build** → **Firestore Database** → **Create database** → start in **test mode** (or production with rules below). Pick a region.
4. In **Firestore** → **Rules**, use rules that allow signed-in users to read/write their own profile and allow the app to create bookings + notifications.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    // Prototype rules for iTRUSH (Firebase-only mode)
    // - Resident creates a booking in `collection_requests`
    // - Admin assigns it to a driver
    // - Driver confirms it
    // - App writes simple `notifications`
    //
    // For a quick demo, allow any signed-in user to read/write these collections.
    // Tighten these later (role-based access, per-user reads, etc.).
    match /collection_requests/{requestId} {
      allow read, write: if request.auth != null;
    }
    match /notifications/{notificationId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

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
python3 -m http.server 5000
```

Or: `npx serve app -l 5000` from the project root.

Open **http://localhost:5000** in your browser. Go to the sign-in page → **Create account** → choose role, fill the form, and sign up. No backend or PostgreSQL needed.

---

## Option B: Use PostgreSQL and the backend API

Follow these steps if you prefer your own database and API instead of Firebase.

**You need:** Node.js (v18+) and PostgreSQL.

---

## Step 1: Install PostgreSQL (if you don’t have it)

**Ubuntu / Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Windows:**  
Download and run the installer from [postgresql.org](https://www.postgresql.org/download/windows/).

---

## Step 2: Create the database and user

Open a terminal and switch to the postgres user (Linux) or use your normal user (macOS/Windows with default install).

**Option A — Using default `postgres` user (simplest for local dev):**
```bash
# Linux: switch to postgres user
sudo -u postgres psql

# Inside psql:
CREATE DATABASE itrush;
\q
```

**Option B — Create a dedicated user and database:**
```bash
sudo -u postgres psql   # or: psql -U postgres

-- In psql:
CREATE USER itrush_user WITH PASSWORD 'your_password';
CREATE DATABASE itrush OWNER itrush_user;
\q
```

Note your connection details. Examples:
- Default (no password): `postgresql://localhost:5432/itrush`
- With user/password: `postgresql://itrush_user:your_password@localhost:5432/itrush`

---

## Step 3: Run the database schema

From the **project root** (the folder that contains `app` and `backend`):

```bash
# If using default postgres user (Linux):
sudo -u postgres psql -d itrush -f backend/schema.sql

# If using a specific user and password (replace with your details):
psql postgresql://itrush_user:your_password@localhost:5432/itrush -f backend/schema.sql
```

You should see `CREATE TABLE` messages. The `users`, `residents`, `collectors`, `kcca_officers`, and other tables are now created.

---

## Step 4: Configure and start the backend API

1. **Go to the backend folder:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create the environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env`** (use any text editor) and set:
   - **DATABASE_URL** — your PostgreSQL connection string  
     Examples:
     - `postgresql://localhost:5432/itrush`
     - `postgresql://itrush_user:your_password@localhost:5432/itrush`
   - **JWT_SECRET** — any long random string (e.g. `mySecretKey123ChangeInProduction!`)

   Example `.env`:
   ```
   PORT=3000
   DATABASE_URL=postgresql://localhost:5432/itrush
   JWT_SECRET=mySuperSecretJWTKeyChangeInProduction123
   ```

5. **Start the API:**
   ```bash
   npm run dev
   ```

   You should see: `iTRUSH API Gateway listening on http://localhost:3000`  
   Leave this terminal open.

---

## Step 5: Serve the frontend (web app)

Open a **new terminal**. The app is static HTML; it must be served over HTTP so that the sign-in page can call the API (avoid opening `index.html` as a file in the browser).

**Important:** The server must serve the **contents** of the `app` folder so that `http://localhost:5000/` shows the landing page. If you see a directory listing (e.g. links to `app/`, `backend/`) instead of the iTRUSH landing page, you are serving from the project root — use one of the options below so that the **document root** is the `app` folder.

**Option A — Using `npx serve` (no global install):**
```bash
cd /path/to/iTRUSH-App
npx serve app -l 5000
```
Then open **http://localhost:5000**

**Option B — Using Python (if you have Python 3):**
```bash
cd /path/to/iTRUSH-App
cd app
python3 -m http.server 5000
```
Then open **http://localhost:5000** (from inside `app`, the server’s root is the app folder, so the landing page loads).

**Option C — Using Node’s `http-server`:**
```bash
cd /path/to/iTRUSH-App
npx http-server app -p 5000
```
Then open **http://localhost:5000**

You should see a message that the app is being served at `http://localhost:5000` (or similar). Leave this terminal open too.

---

## Step 6: Open the app in your browser

1. In your browser go to: **http://localhost:5000**  
   (Use the URL shown by `serve` or your chosen tool; port may differ.)

2. You should see the **iTRUSH landing page** (index).  
   If you see a directory list instead, go back to Step 5 and run the server so it serves the **app** folder (e.g. with Python run `cd app` first).

3. **If using the backend (Option B):** Make sure the API is running (Step 4: `npm run dev` in the `backend` folder).  
   **If using Firebase (Option A):** No backend needed; ensure `app/firebase-config.js` has your real Firebase config.

4. Click **“Request Collection”**, **“Book a Collection”**, or **“Request Pickup”** — each takes you to the **sign-in** page.

5. **Create an account:**
   - On the sign-in page, click the **“Create account”** tab (top of the form).
   - Choose a role: **Resident**, **KCCA**, or **Collector**.
   - Fill all required fields and set a password (at least 8 characters).
   - Click the **“Create account”** (or role-specific) button at the bottom of the form.  
   If nothing seems to happen, check the browser console (F12 → Console) for errors and ensure the backend is running on port 3000.

6. After a successful sign-up, you’ll be redirected to the right dashboard:
   - **Resident** → Resident dashboard  
   - **KCCA** → Admin dashboard  
   - **Collector** → Driver app  

7. To **sign in** again later: go to the sign-in page, enter email and password, and click **Sign in**. You’ll be redirected by role as above.

---

## Quick reference: two terminals

| Terminal 1 (API)      | Terminal 2 (Frontend)   |
|----------------------|-------------------------|
| `cd backend`         | `cd /path/to/iTRUSH-App`|
| `npm run dev`        | `npx serve app -l 5000` |
| Runs on port **3000**| App on port **5000**    |

Then open **http://localhost:5000** in your browser.

---

## Troubleshooting

- **“Cannot reach server” on sign-in**  
  The API must be running on port 3000. Check Terminal 1 and that `.env` has the correct `DATABASE_URL` and `JWT_SECRET`.

- **Database connection errors**  
  Confirm PostgreSQL is running, the database `itrush` exists, and `DATABASE_URL` in `.env` is correct (user, password, host, port, database name).

- **CORS or blank page**  
  Always use the app via the URL from `serve` (e.g. http://localhost:5000), not by opening `index.html` as a file (`file:///...`).

- **Port already in use**  
  Change `PORT` in backend `.env` or use a different port for the frontend (e.g. `npx serve app -l 5001`).
