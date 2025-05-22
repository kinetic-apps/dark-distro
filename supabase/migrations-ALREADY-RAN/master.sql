-- Master migration file for Ghostpost Management Console
-- This file executes all table creations in the correct order

-- Create schema if not exists
CREATE SCHEMA IF NOT EXISTS public;

-- Set up extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create proxies table first (no foreign key dependencies)
\i 'proxies.sql'

-- Step 2: Create accounts table (depends on proxies)
\i 'accounts.sql'

-- Step 3: Create phones table (depends on accounts)
\i 'phones.sql'

-- Step 4: Create posts table (depends on accounts)
\i 'posts.sql'

-- Step 5: Create SMS rentals table (depends on accounts)
\i 'sms_rentals.sql'

-- Step 6: Create tasks table (depends on accounts and posts)
\i 'tasks.sql'

-- Set up realtime publication for all tables
DROP PUBLICATION IF EXISTS ghostpost_realtime;
CREATE PUBLICATION ghostpost_realtime FOR TABLE 
  accounts, 
  phones, 
  posts, 
  proxies, 
  sms_rentals,
  tasks;

-- Grant permissions (adjust as needed for your environment)
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Done! Database is now set up for the Ghostpost Management Console