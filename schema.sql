-- ============================================================
-- REST API Database Schema
-- PostgreSQL
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'done', 'archived');
CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- ============================================================
-- USERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       VARCHAR(255) UNIQUE NOT NULL,
  username    VARCHAR(50)  UNIQUE NOT NULL,
  password    VARCHAR(255) NOT NULL,
  role        user_role    NOT NULL DEFAULT 'user',
  first_name  VARCHAR(100),
  last_name   VARCHAR(100),
  avatar_url  VARCHAR(500),
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role     ON users(role);

-- ============================================================
-- REFRESH TOKENS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       VARCHAR(500) NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ  NOT NULL,
  is_revoked  BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token   ON refresh_tokens(token);

-- ============================================================
-- TASKS TABLE (Secondary Entity)
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id           UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  title        VARCHAR(255)  NOT NULL,
  description  TEXT,
  status       task_status   NOT NULL DEFAULT 'todo',
  priority     task_priority NOT NULL DEFAULT 'medium',
  due_date     TIMESTAMPTZ,
  tags         TEXT[]        DEFAULT '{}',
  owner_id     UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_to  UUID          REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_owner_id    ON tasks(owner_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status      ON tasks(status);
CREATE INDEX idx_tasks_priority    ON tasks(priority);
CREATE INDEX idx_tasks_due_date    ON tasks(due_date);

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  action      VARCHAR(100) NOT NULL,
  resource    VARCHAR(100) NOT NULL,
  resource_id UUID,
  details     JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource   ON audit_logs(resource, resource_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED: Default admin user
-- Password: Admin@123 (bcrypt hashed)
-- ============================================================

INSERT INTO users (email, username, password, role, first_name, last_name)
VALUES (
  'admin@example.com',
  'admin',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQyCjAfozXxMaWwIzJECHxVZS',
  'admin',
  'System',
  'Admin'
) ON CONFLICT DO NOTHING;
