-- HU002: Monitorear el Estado de mi Solicitud de Préstamo
-- 001_hu002.sql

-- 1) Tipo ENUM para los estados normalizados
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'loan_status') THEN
    CREATE TYPE loan_status AS ENUM (
      'PENDING_EVAL','APPROVED','REJECTED',
      'CONTRACT_PENDING','CONTRACT_SIGNED',
      'ACTIVE','DISBURSED'
    );
  END IF;
END$$;

-- 2) Asegurar tabla loan_requests si no existe (según tu HU001)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='loan_requests') THEN
    CREATE TABLE loan_requests (
      id SERIAL PRIMARY KEY,
      amount NUMERIC(12,2) NOT NULL,
      term_months INTEGER NOT NULL,
      monthly_rate NUMERIC(10,6) NOT NULL,
      monthly_payment NUMERIC(12,2) NOT NULL,
      applicant_id INTEGER,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  END IF;
END$$;

-- 3) Asegurar columna updated_at
ALTER TABLE loan_requests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 4) Quitar DEFAULT viejo antes de convertir a ENUM
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='loan_requests' AND column_name='status'
  ) THEN
    ALTER TABLE loan_requests ALTER COLUMN status DROP DEFAULT;
  END IF;
END$$;

-- 5) Convertir TEXT -> ENUM con mapeo (PENDING -> PENDING_EVAL)
ALTER TABLE loan_requests
  ALTER COLUMN status TYPE loan_status
  USING (
    CASE
      WHEN status IN ('PENDING','PENDING_EVAL') THEN 'PENDING_EVAL'::loan_status
      WHEN status='APPROVED' THEN 'APPROVED'::loan_status
      WHEN status='REJECTED' THEN 'REJECTED'::loan_status
      WHEN status='CONTRACT_PENDING' THEN 'CONTRACT_PENDING'::loan_status
      WHEN status='CONTRACT_SIGNED' THEN 'CONTRACT_SIGNED'::loan_status
      WHEN status='ACTIVE' THEN 'ACTIVE'::loan_status
      WHEN status='DISBURSED' THEN 'DISBURSED'::loan_status
      ELSE 'PENDING_EVAL'::loan_status
    END
  );

-- 6) Reasignar DEFAULT nuevo
ALTER TABLE loan_requests
  ALTER COLUMN status SET DEFAULT 'PENDING_EVAL';

CREATE INDEX IF NOT EXISTS idx_lr_status ON loan_requests(status);
CREATE INDEX IF NOT EXISTS idx_lr_applicant ON loan_requests(applicant_id);

-- 7) Timeline de eventos
CREATE TABLE IF NOT EXISTS loan_request_events (
  id BIGSERIAL PRIMARY KEY,
  loan_request_id BIGINT NOT NULL REFERENCES loan_requests(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_lr ON loan_request_events(loan_request_id);

-- 8) Outbox de notificaciones (mock)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notify_channel') THEN
    CREATE TYPE notify_channel AS ENUM ('EMAIL','SMS');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS notifications (
  id BIGSERIAL PRIMARY KEY,
  loan_request_id BIGINT NOT NULL REFERENCES loan_requests(id) ON DELETE CASCADE,
  channel notify_channel NOT NULL DEFAULT 'EMAIL',
  template TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED|SENT|FAILED
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

-- 9) Trigger: registrar evento al cambiar estado
CREATE OR REPLACE FUNCTION trg_lr_state_event()
RETURNS trigger AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.updated_at := NOW();
    INSERT INTO loan_request_events(loan_request_id, event_type, event_data)
    VALUES (NEW.id, 'STATE_CHANGED', jsonb_build_object('from', OLD.status, 'to', NEW.status));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_lr_state_change ON loan_requests;
CREATE TRIGGER on_lr_state_change
BEFORE UPDATE OF status ON loan_requests
FOR EACH ROW EXECUTE FUNCTION trg_lr_state_event();
