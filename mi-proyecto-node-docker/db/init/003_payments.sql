-- Payments table initialization
CREATE TABLE IF NOT EXISTS loan_installment_payments (
    id SERIAL PRIMARY KEY,
    loan_request_id INTEGER NOT NULL REFERENCES loan_requests(id) ON DELETE CASCADE,
    installment INTEGER NOT NULL,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT NOT NULL DEFAULT 'CLP',
    status TEXT NOT NULL DEFAULT 'INITIATED',
    transbank_token TEXT,
    transbank_buy_order TEXT,
    transbank_session_id TEXT,
    response JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_installments_loan ON loan_installment_payments(loan_request_id);
CREATE INDEX IF NOT EXISTS idx_installments_token ON loan_installment_payments(transbank_token);