CREATE TABLE simulator_state (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  enabled boolean NOT NULL DEFAULT false,
  scenario text NOT NULL DEFAULT 'normal' CHECK (scenario IN ('normal', 'attention', 'critical', 'demo')),
  interval_ms integer NOT NULL DEFAULT 5000 CHECK (interval_ms BETWEEN 1000 AND 60000),
  clean_level double precision NOT NULL DEFAULT 72 CHECK (clean_level BETWEEN 0 AND 100),
  used_level double precision NOT NULL DEFAULT 38 CHECK (used_level BETWEEN 0 AND 100),
  tick_count integer NOT NULL DEFAULT 0 CHECK (tick_count >= 0),
  last_tick_at timestamptz,
  next_tick_at timestamptz,
  worker_seen_at timestamptz,
  CHECK (enabled = (next_tick_at IS NOT NULL))
);

INSERT INTO simulator_state DEFAULT VALUES;
