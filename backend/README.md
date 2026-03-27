# iTRUSH API Gateway

Node.js API gateway for the CleanGKMA / iTRUSH app: REST endpoints, JWT auth, and role-based access. Aligns with the 3-tier architecture (Client → API Gateway → Services → PostgreSQL + Supabase).

## Setup

1. **Install dependencies**
   ```bash
   cd backend && npm install
   ```

2. **PostgreSQL**
   - Create a database (e.g. `itrush`).
   - Run the schema:
     ```bash
     psql $DATABASE_URL -f schema.sql
     ```
   - Or with explicit URL:
     ```bash
     psql postgresql://user:password@localhost:5432/itrush -f schema.sql
     ```

3. **Environment**
   - Copy `.env.example` to `.env` and set:
     - `DATABASE_URL` — PostgreSQL connection string
     - `JWT_SECRET` — secret for signing JWTs (use a long random string in production)
     - `PORT` — optional, default 3000

4. **Run the API**
   ```bash
   npm run dev
   ```
   Or `npm start` for production.

The API listens on `http://localhost:3000`. The sign-in page uses this base URL by default (override with `window.ITRUSH_API_URL` if needed).

## Auth endpoints

- **POST /api/auth/signin**  
  Body: `{ "email": "...", "password": "..." }`  
  Returns: `{ "token": "JWT...", "user": { "id", "email", "role" } }`

- **POST /api/auth/signup**  
  Body: `{ "role": "resident"|"collector"|"kcca", "email": "...", "password": "...", ...profile }`  
  Profile fields by role:
  - **resident**: first_name, last_name, phone, zone
  - **kcca**: first_name, last_name, department, jurisdiction, staff_id
  - **collector**: full_name, phone, company, truck_plate, primary_zone  
  Returns: same as signin.

After sign-in/signup, the frontend stores the JWT in `localStorage` under `itrush_token` and redirects by role: Resident → `resident_dashboard.html`, KCCA → `admin_dashboard.html`, Collector → `driver_app.html`.

## Database schema

See `schema.sql` for the 9 tables: `users`, `residents`, `collectors`, `kcca_officers`, `collection_requests`, `gps_logs`, `notifications`, `invoices`, `overflow_reports`.
