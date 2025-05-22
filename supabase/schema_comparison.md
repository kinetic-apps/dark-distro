# Schema Comparison: migrations-ALREADY-RAN vs 001_initial_schema.sql

## Summary of Differences

### 1. **accounts** table differences:
- **Missing in ALREADY-RAN:**
  - `tiktok_username` (TEXT UNIQUE)
  - `stage` (TEXT with CHECK constraint)
  - `warmup_progress` (INTEGER DEFAULT 0)
  - `updated_at` (TIMESTAMPTZ)
  - `banned_at` (TIMESTAMPTZ)
  - `error_count` (INTEGER DEFAULT 0)
  - `last_error` (TEXT)
  - `meta` (JSONB)
- **Different in ALREADY-RAN:**
  - Uses `gen_random_uuid()` instead of `uuid_generate_v4()`
  - Has `last_used` instead of `updated_at`
  - `status` is TEXT without CHECK constraint (vs `stage` with CHECK)
- **Extra in ALREADY-RAN:**
  - Table comments

### 2. **phones** table differences:
- **Missing in ALREADY-RAN:**
  - `id` (UUID PRIMARY KEY) - uses `profile_id` as PK instead
  - `status` CHECK constraint (has TEXT without constraint)
  - `device_model` (TEXT)
  - `android_version` (TEXT)
  - `last_heartbeat` (TIMESTAMPTZ) - has `last_seen` instead
  - `updated_at` (TIMESTAMPTZ)
  - `meta` (JSONB)
- **Different in ALREADY-RAN:**
  - Primary key is `profile_id` instead of UUID `id`
  - Has `proxy_ip` instead of proxy reference
  - Has `version` instead of `device_model`/`android_version`
  - `battery` is INT instead of INTEGER
- **Extra in ALREADY-RAN:**
  - `error_count` (INT DEFAULT 0)

### 3. **proxies** table differences:
- **Missing in ALREADY-RAN:**
  - `label` (TEXT NOT NULL)
  - `type` (TEXT with CHECK constraint)
  - `host` (TEXT NOT NULL)
  - `port` (INTEGER NOT NULL) - has `soax_port` instead
  - `username` (TEXT)
  - `password` (TEXT)
  - `session_id` (TEXT)
  - `current_ip` (INET) - has TEXT instead
  - `health` (TEXT with CHECK constraint)
  - `assigned_account_id` (UUID REFERENCES)
  - `updated_at` (TIMESTAMPTZ)
  - `meta` (JSONB)
  - UNIQUE constraint on (host, port)
- **Different in ALREADY-RAN:**
  - Uses `soax_port` (INT) instead of generic `host`/`port`
  - `current_ip` is TEXT instead of INET
  - No support for different proxy types or authentication

### 4. **sms_rentals** table differences:
- **Missing in ALREADY-RAN:**
  - `rental_id` (TEXT UNIQUE) - has `daisy_id` instead
  - `otp_code` (TEXT) - has `otp` instead
  - `status` CHECK constraint (has TEXT without constraint)
  - `updated_at` (TIMESTAMPTZ)
  - `meta` (JSONB)
- **Different in ALREADY-RAN:**
  - Uses `daisy_id` instead of `rental_id`
  - Has `country_code` (TEXT) - not in initial schema
  - Has `service` (TEXT DEFAULT 'tiktok') - not in initial schema
  - `otp` instead of `otp_code`

### 5. **posts** table differences:
- **Missing in ALREADY-RAN:**
  - `asset_path` (TEXT NOT NULL) - has `video_path` instead
  - `hashtags` (TEXT[])
  - `geelark_task_id` (TEXT) - has `task_id` instead
  - `status` CHECK constraint (has TEXT without constraint)
  - `posted_at` (TIMESTAMPTZ) - exists but different context
  - `error` (TEXT) - has `error_message` instead
  - `updated_at` (TIMESTAMPTZ)
  - `meta` (JSONB)
- **Different in ALREADY-RAN:**
  - Uses `video_path` instead of `asset_path`
  - `task_id` instead of `geelark_task_id`
  - `error_message` instead of `error`

### 6. **tasks** table differences:
- **Missing in ALREADY-RAN:**
  - `type` (TEXT with CHECK constraint) - has `task_type` instead
  - `status` CHECK constraint (has TEXT without constraint)
  - `started_at` (TIMESTAMPTZ)
  - `ended_at` (TIMESTAMPTZ) - has `completed_at` instead
  - `message` (TEXT)
  - `updated_at` (TIMESTAMPTZ)
  - `meta` (JSONB)
- **Different in ALREADY-RAN:**
  - `task_type` instead of `type`
  - Has `post_id` (UUID REFERENCES) - not in initial schema
  - Has `result` (TEXT) - not in initial schema
  - `completed_at` instead of `ended_at`
  - `error_message` instead of generic `message`

### 7. **logs** table:
- **Completely missing in ALREADY-RAN migrations**

### 8. **Other differences:**
- **Extensions:** ALREADY-RAN uses `uuid-ossp` vs initial schema uses both
- **Functions:** Initial schema has `update_updated_at_column()` trigger function
- **Triggers:** Initial schema has update triggers for all tables
- **Policies:** Initial schema has RLS policies defined, ALREADY-RAN only enables RLS
- **Publications:** ALREADY-RAN creates `ghostpost_realtime` publication
- **Permissions:** ALREADY-RAN grants permissions to postgres user

## Migration Strategy

To align the existing schema with the new one, you would need to:

1. Add missing columns to existing tables
2. Add CHECK constraints to existing columns
3. Create the missing `logs` table
4. Add the trigger function and triggers
5. Add RLS policies
6. Update data types where different (e.g., INET vs TEXT for IPs)
7. Handle renamed columns (e.g., `daisy_id` → `rental_id`)