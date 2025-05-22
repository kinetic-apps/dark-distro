-- sms_rentals table: Manages daisySMS phone number rentals
CREATE TABLE IF NOT EXISTS sms_rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daisy_id TEXT NOT NULL UNIQUE,
  phone_number TEXT,
  country_code TEXT,
  otp TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID,
  service TEXT DEFAULT 'tiktok',
  CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_sms_rentals_status ON sms_rentals(status);
CREATE INDEX IF NOT EXISTS idx_sms_rentals_expires_at ON sms_rentals(expires_at);
CREATE INDEX IF NOT EXISTS idx_sms_rentals_account_id ON sms_rentals(account_id);

-- Enable RLS
ALTER TABLE sms_rentals ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE sms_rentals IS 'DaisySMS phone number rentals for verification';
COMMENT ON COLUMN sms_rentals.daisy_id IS 'Unique rental ID from daisySMS';
COMMENT ON COLUMN sms_rentals.phone_number IS 'Rented phone number';
COMMENT ON COLUMN sms_rentals.country_code IS 'Country code of phone number';
COMMENT ON COLUMN sms_rentals.otp IS 'One-time password received via SMS';
COMMENT ON COLUMN sms_rentals.expires_at IS 'Expiration timestamp for rental';
COMMENT ON COLUMN sms_rentals.status IS 'Rental status (active, expired, canceled)';
COMMENT ON COLUMN sms_rentals.account_id IS 'Account associated with this rental';
COMMENT ON COLUMN sms_rentals.service IS 'Service being verified (tiktok, etc)';