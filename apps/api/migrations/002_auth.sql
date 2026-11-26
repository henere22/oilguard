CREATE TABLE users (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username text NOT NULL UNIQUE,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'operator')),
  is_primary boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  password_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT is_primary OR (role = 'admin' AND active))
);
CREATE UNIQUE INDEX users_one_primary ON users(is_primary) WHERE is_primary;

CREATE TABLE user_sessions (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
CREATE INDEX user_sessions_user ON user_sessions(user_id) WHERE revoked_at IS NULL;

CREATE TABLE password_recovery_tokens (
  token_hash text PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE INDEX recovery_user ON password_recovery_tokens(user_id) WHERE used_at IS NULL;

CREATE TABLE audit_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id integer REFERENCES users(id),
  target_user_id integer REFERENCES users(id),
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_limits (
  bucket text PRIMARY KEY,
  attempts integer NOT NULL,
  expires_at timestamptz NOT NULL
);
CREATE INDEX login_limits_expiry ON login_limits(expires_at);
