-- proxies table: Manages SOAX proxy connections
CREATE TABLE IF NOT EXISTS proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soax_port INT NOT NULL UNIQUE,
  current_ip TEXT,
  last_rotated TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);
CREATE INDEX IF NOT EXISTS idx_proxies_last_rotated ON proxies(last_rotated);

-- Enable RLS
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE proxies IS 'SOAX proxy management for GeeLark phones';
COMMENT ON COLUMN proxies.soax_port IS 'Unique port number assigned by SOAX';
COMMENT ON COLUMN proxies.current_ip IS 'Current external IP address of the proxy';
COMMENT ON COLUMN proxies.last_rotated IS 'When the proxy IP was last rotated';
COMMENT ON COLUMN proxies.status IS 'Proxy status (active, blocked, etc)';