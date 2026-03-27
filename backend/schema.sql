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
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'dispatched', 'in_progress', 'completed', 'disputed')),
  scheduled_at      TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gps_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id      UUID NOT NULL REFERENCES collectors(id),
  request_id        UUID REFERENCES collection_requests(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id),
  type              TEXT,
  message           TEXT,
  read_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
