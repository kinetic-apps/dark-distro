-- posts table: Tracks content distribution status
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID,
  video_path TEXT NOT NULL,
  caption TEXT,
  status TEXT DEFAULT 'queued',
  tiktok_post_id TEXT,
  task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_account_id ON posts(account_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);

-- Enable RLS
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE posts IS 'Content posts tracking for TikTok distribution';
COMMENT ON COLUMN posts.account_id IS 'Account used for posting';
COMMENT ON COLUMN posts.video_path IS 'Path to video in Supabase Storage';
COMMENT ON COLUMN posts.caption IS 'Text caption for the post';
COMMENT ON COLUMN posts.status IS 'Post status (queued, processing, posted, failed)';
COMMENT ON COLUMN posts.tiktok_post_id IS 'TikTok post ID after successful posting';
COMMENT ON COLUMN posts.task_id IS 'GeeLark task ID for posting operation';
COMMENT ON COLUMN posts.posted_at IS 'Timestamp when post was successfully published';
COMMENT ON COLUMN posts.error_message IS 'Error details if posting failed';
COMMENT ON COLUMN posts.retry_count IS 'Number of posting attempts made';