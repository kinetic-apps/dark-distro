-- tasks table: Tracks GeeLark tasks (warmup, posting, etc)
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geelark_task_id TEXT UNIQUE,
  task_type TEXT NOT NULL,
  account_id UUID,
  post_id UUID,
  status TEXT DEFAULT 'pending',
  result TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  CONSTRAINT fk_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  CONSTRAINT fk_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_account_id ON tasks(account_id);
CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);

-- Enable RLS
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Add comments for documentation
COMMENT ON TABLE tasks IS 'GeeLark task tracking and management';
COMMENT ON COLUMN tasks.geelark_task_id IS 'Task ID from GeeLark API';
COMMENT ON COLUMN tasks.task_type IS 'Type of task (warmup, post, etc)';
COMMENT ON COLUMN tasks.account_id IS 'Account associated with this task';
COMMENT ON COLUMN tasks.post_id IS 'Related post if this is a posting task';
COMMENT ON COLUMN tasks.status IS 'Task status (pending, running, completed, failed)';
COMMENT ON COLUMN tasks.result IS 'Task result data as JSON';
COMMENT ON COLUMN tasks.completed_at IS 'When the task completed';
COMMENT ON COLUMN tasks.error_message IS 'Error details if task failed';