-- accounts table: Manages cloud phone accounts
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geelark_profile_id TEXT NOT NULL UNIQUE,
  warmup_done BOOLEAN DEFAULT FALSE,
  proxy_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used TIMESTAMPTZ,
  status TEXT DEFAULT 'new',
  CONSTRAINT fk_proxy FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_last_used ON accounts(last_used);

-- Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE accounts IS 'Cloud phone accounts for content distribution';
COMMENT ON COLUMN accounts.geelark_profile_id IS 'Unique profile ID from GeeLark API';
COMMENT ON COLUMN accounts.warmup_done IS 'Whether account has completed initial warmup process';
COMMENT ON COLUMN accounts.proxy_id IS 'Associated proxy from proxies table';
COMMENT ON COLUMN accounts.last_used IS 'When the account was last used for posting';
COMMENT ON COLUMN accounts.status IS 'Account status (new, active, banned, etc)';