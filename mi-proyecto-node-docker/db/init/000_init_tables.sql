-- Ensure base tables exist before specific tables like loan_requests
CREATE TABLE IF NOT EXISTS applicants (
  id SERIAL PRIMARY KEY,
  national_id TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth DATE NOT NULL,
  nationality TEXT,
  address TEXT NOT NULL,
  address_proof_type TEXT,
  address_proof_ref TEXT,
  income_source TEXT,
  monthly_income NUMERIC(12,2),
  income_proof_type TEXT,
  income_proof_ref TEXT,
  financial_history_note TEXT,
  password_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
