-- Add missing columns and constraints to existing tables

-- 1. Update accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS tiktok_username TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS warmup_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraint for status (not stage)
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_status_check;
ALTER TABLE accounts ADD CONSTRAINT accounts_status_check 
CHECK (status IN ('new', 'warming_up', 'active', 'paused', 'banned'));

-- 2. Update phones table
ALTER TABLE phones 
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraint for status
ALTER TABLE phones DROP CONSTRAINT IF EXISTS phones_status_check;
ALTER TABLE phones ADD CONSTRAINT phones_status_check 
CHECK (status IN ('online', 'offline', 'error'));

-- 3. Update proxies table
ALTER TABLE proxies 
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraints
ALTER TABLE proxies DROP CONSTRAINT IF EXISTS proxies_type_check;
ALTER TABLE proxies ADD CONSTRAINT proxies_type_check 
CHECK (type IN ('sticky', 'rotating', 'sim'));

ALTER TABLE proxies DROP CONSTRAINT IF EXISTS proxies_health_check;
ALTER TABLE proxies ADD CONSTRAINT proxies_health_check 
CHECK (health IN ('good', 'slow', 'blocked', 'unknown'));

-- 4. Update sms_rentals table
-- Check if column exists before renaming
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_rentals' AND column_name = 'daisy_id') THEN
        ALTER TABLE sms_rentals RENAME COLUMN daisy_id TO rental_id;
    END IF;
END $$;

ALTER TABLE sms_rentals 
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraint for status
ALTER TABLE sms_rentals DROP CONSTRAINT IF EXISTS sms_rentals_status_check;
ALTER TABLE sms_rentals ADD CONSTRAINT sms_rentals_status_check 
CHECK (status IN ('waiting', 'received', 'cancelled', 'expired'));

-- 5. Update posts table
-- Check if column exists before renaming
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'posts' AND column_name = 'video_path') THEN
        ALTER TABLE posts RENAME COLUMN video_path TO asset_path;
    END IF;
END $$;

ALTER TABLE posts 
ADD COLUMN IF NOT EXISTS hashtags TEXT[],
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraint for status
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_status_check;
ALTER TABLE posts ADD CONSTRAINT posts_status_check 
CHECK (status IN ('queued', 'processing', 'posted', 'failed', 'cancelled'));

-- 6. Update tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add CHECK constraints
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_type_check 
CHECK (type IN ('warmup', 'post', 'check_status', 'other'));

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled'));

-- 7. Create logs table (completely missing)
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level TEXT CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')) NOT NULL,
    component TEXT NOT NULL,
    account_id UUID REFERENCES accounts(id),
    message TEXT NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for logs
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_logs_level ON logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_account_id ON logs(account_id);

-- 8. Create missing indexes
CREATE INDEX IF NOT EXISTS idx_accounts_proxy_id ON accounts(proxy_id);
CREATE INDEX IF NOT EXISTS idx_phones_account_id ON phones(account_id);
CREATE INDEX IF NOT EXISTS idx_proxies_type ON proxies(type);
CREATE INDEX IF NOT EXISTS idx_proxies_health ON proxies(health);
CREATE INDEX IF NOT EXISTS idx_sms_rentals_status ON sms_rentals(status);
CREATE INDEX IF NOT EXISTS idx_sms_rentals_expires_at ON sms_rentals(expires_at);
CREATE INDEX IF NOT EXISTS idx_posts_account_id ON posts(account_id);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);

-- 9. Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 10. Apply updated_at triggers
DROP TRIGGER IF EXISTS update_accounts_updated_at ON accounts;
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_phones_updated_at ON phones;
CREATE TRIGGER update_phones_updated_at BEFORE UPDATE ON phones 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proxies_updated_at ON proxies;
CREATE TRIGGER update_proxies_updated_at BEFORE UPDATE ON proxies 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_sms_rentals_updated_at ON sms_rentals;
CREATE TRIGGER update_sms_rentals_updated_at BEFORE UPDATE ON sms_rentals 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks 
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Since RLS doesn't matter for internal tool, we'll skip the policies
-- but enable RLS on logs table to match others
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;