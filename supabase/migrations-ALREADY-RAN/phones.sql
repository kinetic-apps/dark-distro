-- phones table: Tracks GeeLark phone status
CREATE TABLE IF NOT EXISTS phones (
  profile_id TEXT PRIMARY KEY,
  battery INT,
  proxy_ip TEXT,
  last_seen TIMESTAMPTZ,
  status TEXT DEFAULT 'unknown',
  version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  account_id UUID UNIQUE,
  error_count INT DEFAULT 0,
  CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_phones_status ON phones(status);
CREATE INDEX IF NOT EXISTS idx_phones_last_seen ON phones(last_seen);

-- Enable RLS
ALTER TABLE phones ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE phones IS 'GeeLark cloud phone status monitoring';
COMMENT ON COLUMN phones.profile_id IS 'Unique profile ID from GeeLark';
COMMENT ON COLUMN phones.battery IS 'Current battery percentage';
COMMENT ON COLUMN phones.proxy_ip IS 'Current proxy IP being used';
COMMENT ON COLUMN phones.last_seen IS 'Last status update timestamp';
COMMENT ON COLUMN phones.status IS 'Phone status (online, offline, busy, etc)';
COMMENT ON COLUMN phones.version IS 'GeeLark app version';
COMMENT ON COLUMN phones.account_id IS 'Associated account from accounts table';
COMMENT ON COLUMN phones.error_count IS 'Number of errors encountered';