ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS installment_num INTEGER;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_date DATE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_cobranza_dedup
  ON notifications (loan_request_id, installment_num, notification_date)
  WHERE installment_num IS NOT NULL AND notification_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (read_at)
  WHERE read_at IS NULL;
