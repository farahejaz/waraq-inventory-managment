-- ============================================================
-- Waraq Business Manager — Supabase Database Setup
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- Sessions table (required by express-session / connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid    VARCHAR NOT NULL PRIMARY KEY,
  sess   JSON    NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS IDX_session_expire ON session (expire);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50) UNIQUE NOT NULL,
  password   VARCHAR(255) NOT NULL,
  role       VARCHAR(20) NOT NULL DEFAULT 'manager'
             CHECK (role IN ('admin','manager','accountant')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Main data store (JSONB key-value — one row per collection)
-- Each business collection is stored as a JSONB array
CREATE TABLE IF NOT EXISTS waraq_data (
  key        VARCHAR(50) PRIMARY KEY,
  value      JSONB NOT NULL DEFAULT '[]',
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(50)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  username   VARCHAR(50),
  action     VARCHAR(20),
  collection VARCHAR(50),
  record_id  VARCHAR(50),
  detail     TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed empty collections
INSERT INTO waraq_data (key, value) VALUES ('suppliers',    '[]') ON CONFLICT (key) DO NOTHING;
INSERT INTO waraq_data (key, value) VALUES ('customers',    '[]') ON CONFLICT (key) DO NOTHING;
INSERT INTO waraq_data (key, value) VALUES ('rawmaterials', '[]') ON CONFLICT (key) DO NOTHING;
INSERT INTO waraq_data (key, value) VALUES ('products',     '[]') ON CONFLICT (key) DO NOTHING;
INSERT INTO waraq_data (key, value) VALUES ('purchases',    '[]') ON CONFLICT (key) DO NOTHING;
INSERT INTO waraq_data (key, value) VALUES ('sales',        '[]') ON CONFLICT (key) DO NOTHING;
INSERT INTO waraq_data (key, value) VALUES ('production',   '[]') ON CONFLICT (key) DO NOTHING;
INSERT INTO waraq_data (key, value) VALUES ('cashflow',     '[]') ON CONFLICT (key) DO NOTHING;

-- Default admin user  (password: admin123)
-- IMPORTANT: Change this password immediately after first login!
INSERT INTO users (username, password, role)
VALUES (
  'admin',
  '$2b$10$dFibx.EM55kR3XgZwJir0eBosyneK3vfFYLnmdGg2Lq3hm5Yty2PO',
  'admin'
)
ON CONFLICT (username) DO NOTHING;

-- Default manager user (password: manager123)
INSERT INTO users (username, password, role)
VALUES (
  'manager',
  '$2b$10$1.Ckch.QPg76Y0pJgL60S.cW96.lxgi0Rq9OgU5Ao6Vv3x1oiIBUy',
  'manager'
)
ON CONFLICT (username) DO NOTHING;

-- Default accountant user (password: account123)
INSERT INTO users (username, password, role)
VALUES (
  'accountant',
  '$2b$10$luBTai7fj6sy34d8KbaC2OtMDuXK..m5z8z70qriGSfHq7OnkvF2a',
  'accountant'
)
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- Setup complete! You should see no errors above.
-- Default credentials:
--   admin     / admin123
--   manager   / manager123
--   accountant / account123
-- CHANGE THESE IMMEDIATELY after first login via User Management.
-- ============================================================

-- AK Copy House Multan additions
-- Add salaries collection support (uses same waraq_data key-value store)
-- No schema change needed; 'salaries' is stored as JSON under key 'salaries' in waraq_data
