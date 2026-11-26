CREATE TABLE report_snapshots (
  report_type text NOT NULL CHECK (report_type IN ('daily', 'period')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  generated_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (report_type, start_date, end_date),
  CHECK (start_date <= end_date),
  CHECK (report_type <> 'daily' OR start_date = end_date)
);
