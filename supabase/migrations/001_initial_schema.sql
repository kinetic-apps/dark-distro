-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Accounts table (TikTok accounts)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tiktok_username TEXT UNIQUE,
    geelark_profile_id TEXT UNIQUE,
    stage TEXT CHECK (stage IN ('new', 'warming_up', 'active', 'paused', 'banned')) DEFAULT 'new',
    warmup_done BOOLEAN DEFAULT FALSE,
    warmup_progress INTEGER DEFAULT 0,
    proxy_id UUID REFERENCES proxies(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    banned_at TIMESTAMPTZ,
    error_count INTEGER DEFAULT 0,
    last_error TEXT,
    meta JSONB DEFAULT '{}'::jsonb
);

-- Phones table (GeeLark phone profiles)
CREATE TABLE phones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id TEXT UNIQUE NOT NULL,
    account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('online', 'offline', 'error')) DEFAULT 'offline',
    battery INTEGER,
    device_model TEXT,
    android_version TEXT,
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    meta JSONB DEFAULT '{}'::jsonb
);

-- Proxies table
CREATE TABLE proxies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    label TEXT NOT NULL,
    type TEXT CHECK (type IN ('sticky', 'rotating', 'sim')) NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL,
    username TEXT,
    password TEXT,
    session_id TEXT,
    current_ip INET,
    last_rotated TIMESTAMPTZ DEFAULT NOW(),
    health TEXT CHECK (health IN ('good', 'slow', 'blocked', 'unknown')) DEFAULT 'unknown',
    assigned_account_id UUID REFERENCES accounts(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    meta JSONB DEFAULT '{}'::jsonb,
    UNIQUE(host, port)
);

-- SMS Rentals table
CREATE TABLE sms_rentals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rental_id TEXT UNIQUE,
    phone_number TEXT NOT NULL,
    otp_code TEXT,
    status TEXT CHECK (status IN ('waiting', 'received', 'cancelled', 'expired')) DEFAULT 'waiting',
    expires_at TIMESTAMPTZ NOT NULL,
    account_id UUID REFERENCES accounts(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    meta JSONB DEFAULT '{}'::jsonb
);

-- Posts table
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES accounts(id) NOT NULL,
    asset_path TEXT NOT NULL,
    caption TEXT,
    hashtags TEXT[],
    geelark_task_id TEXT,
    status TEXT CHECK (status IN ('queued', 'processing', 'posted', 'failed', 'cancelled')) DEFAULT 'queued',
    tiktok_post_id TEXT,
    posted_at TIMESTAMPTZ,
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    meta JSONB DEFAULT '{}'::jsonb
);

-- Tasks table (GeeLark automation tasks)
CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT CHECK (type IN ('warmup', 'post', 'check_status', 'other')) NOT NULL,
    geelark_task_id TEXT UNIQUE,
    account_id UUID REFERENCES accounts(id),
    status TEXT CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    meta JSONB DEFAULT '{}'::jsonb
);

-- Logs table
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    level TEXT CHECK (level IN ('debug', 'info', 'warning', 'error', 'critical')) NOT NULL,
    component TEXT NOT NULL,
    account_id UUID REFERENCES accounts(id),
    message TEXT NOT NULL,
    meta JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_accounts_stage ON accounts(stage);
CREATE INDEX idx_accounts_proxy_id ON accounts(proxy_id);
CREATE INDEX idx_phones_account_id ON phones(account_id);
CREATE INDEX idx_proxies_type ON proxies(type);
CREATE INDEX idx_proxies_health ON proxies(health);
CREATE INDEX idx_sms_rentals_status ON sms_rentals(status);
CREATE INDEX idx_sms_rentals_expires_at ON sms_rentals(expires_at);
CREATE INDEX idx_posts_account_id ON posts(account_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_tasks_account_id ON tasks(account_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_account_id ON logs(account_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phones_updated_at BEFORE UPDATE ON phones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_proxies_updated_at BEFORE UPDATE ON proxies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sms_rentals_updated_at BEFORE UPDATE ON sms_rentals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;

-- Create policies (allow authenticated users full access for now)
CREATE POLICY "Allow authenticated users" ON accounts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON phones FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON proxies FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON sms_rentals FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON posts FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON tasks FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users" ON logs FOR ALL TO authenticated USING (true);