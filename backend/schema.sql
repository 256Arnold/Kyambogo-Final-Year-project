-- iTRUSH / CleanGKMA — PostgreSQL schema (9 tables)
-- Run once: psql $DATABASE_URL -f schema.sql
-- Optional: CREATE EXTENSION IF NOT EXISTS postgis;

-- Single identity table for all roles (resident, collector, kcca_officer)
CREATE TABLE IF NOT EXISTS users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  role              TEXT NOT NULL CHECK (role IN ('resident', 'collector', 'kcca_officer')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Profile extensions (one row per user by role)
CREATE TABLE IF NOT EXISTS residents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name        TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  phone             TEXT,
  zone              TEXT,
  pickup_address    TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS collectors (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name         TEXT NOT NULL,
  phone             TEXT,
  company           TEXT,
  truck_plate       TEXT,
  primary_zone      TEXT,
  completion_rate   NUMERIC(5,2) DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS kcca_officers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  first_name        TEXT NOT NULL,
  last_name        TEXT NOT NULL,
  department        TEXT,
  jurisdiction      TEXT,
  staff_id          TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Operational tables (referenced by architecture)
CREATE TABLE IF NOT EXISTS collection_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id       UUID NOT NULL REFERENCES residents(id),
  collector_id      UUID REFERENCES collectors(id),
  waste_type        TEXT,
  volume            TEXT,
  zone              TEXT,
  pickup_address    TEXT,
  latitude          NUMERIC(9,6),
  longitude         NUMERIC(9,6),
  preferred_date    DATE,
  preferred_time    TEXT,
  notes             TEXT,
  amount_ugx        NUMERIC(12,2) DEFAULT 0,
  payment_status    TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  status            TEXT NOT NULL DEFAULT 'pending_assignment' CHECK (status IN ('pending_assignment', 'paid_pending_assignment', 'assigned', 'in_progress', 'completed', 'disputed', 'cancelled')),
  scheduled_at      TIMESTAMPTZ,
  assigned_at       TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE collection_requests
  ADD COLUMN IF NOT EXISTS zone TEXT,
  ADD COLUMN IF NOT EXISTS pickup_address TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(9,6),
  ADD COLUMN IF NOT EXISTS preferred_date DATE,
  ADD COLUMN IF NOT EXISTS preferred_time TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS amount_ugx NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name = 'collection_requests' AND column_name = 'status'
  ) THEN
    ALTER TABLE collection_requests DROP CONSTRAINT IF EXISTS collection_requests_status_check;
    ALTER TABLE collection_requests
      ADD CONSTRAINT collection_requests_status_check
      CHECK (status IN ('pending_assignment', 'paid_pending_assignment', 'assigned', 'in_progress', 'completed', 'disputed', 'cancelled'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS gps_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id      UUID NOT NULL REFERENCES collectors(id),
  request_id        UUID REFERENCES collection_requests(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  request_id        UUID REFERENCES collection_requests(id),
  type              TEXT,
  message           TEXT,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES collection_requests(id);

CREATE TABLE IF NOT EXISTS invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id        UUID NOT NULL REFERENCES collection_requests(id),
  amount_ugx        NUMERIC(12,2),
  payment_method    TEXT,
  status            TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'paid', 'disputed')),
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS overflow_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  type              TEXT NOT NULL CHECK (type IN ('missed_pickup', 'overflow', 'illegal_dump')),
  severity          TEXT,
  assigned_to       UUID REFERENCES kcca_officers(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
