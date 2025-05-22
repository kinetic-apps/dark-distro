# GhostPost Database Schema Documentation

## Overview

The GhostPost database is designed to support a TikTok content distribution system using GeeLark cloud phones and various automation tools. The database consists of two main parts:

1. **Template Gallery System** - For managing user-generated content templates
2. **Content Distribution System** - For managing TikTok accounts, proxies, posts, and automation tasks

## Database Tables

### Core Distribution System

#### 1. `accounts` - Cloud Phone Account Management
**Purpose**: Tracks TikTok accounts managed through GeeLark cloud phones

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `geelark_profile_id` | `text` | NO | - | Unique profile ID from GeeLark API |
| `tiktok_username` | `text` | YES | - | TikTok username (unique) |
| `warmup_done` | `boolean` | YES | `false` | Whether account has completed initial warmup |
| `warmup_progress` | `integer` | YES | `0` | Warmup completion percentage |
| `proxy_id` | `uuid` | YES | - | Associated proxy (FK to proxies) |
| `status` | `text` | YES | `'new'` | Account status |
| `banned_at` | `timestamptz` | YES | - | When account was banned |
| `error_count` | `integer` | YES | `0` | Number of errors encountered |
| `last_error` | `text` | YES | - | Last error message |
| `last_used` | `timestamptz` | YES | - | When account was last used for posting |
| `meta` | `jsonb` | YES | `'{}'` | Additional metadata |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `geelark_profile_id`, `tiktok_username`
- Check: `status IN ('new', 'warming_up', 'active', 'paused', 'banned')`
- Foreign Key: `proxy_id` → `proxies(id)`

**Indexes:**
- `accounts_pkey` (id)
- `accounts_geelark_profile_id_key` (geelark_profile_id)
- `accounts_tiktok_username_key` (tiktok_username)
- `idx_accounts_proxy_id` (proxy_id)
- `idx_accounts_status` (status)
- `idx_accounts_last_used` (last_used)

---

#### 2. `proxies` - SOAX Proxy Management
**Purpose**: Manages SOAX proxy configurations for GeeLark phones

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `soax_port` | `integer` | NO | - | Unique port number assigned by SOAX |
| `current_ip` | `text` | YES | - | Current external IP address |
| `type` | `text` | YES | `'sticky'` | Proxy type |
| `health` | `text` | YES | `'unknown'` | Proxy health status |
| `last_rotated` | `timestamptz` | YES | `now()` | When proxy IP was last rotated |
| `status` | `text` | YES | `'active'` | Proxy status |
| `meta` | `jsonb` | YES | `'{}'` | Additional metadata |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `soax_port`
- Check: `type IN ('sticky', 'rotating', 'sim')`
- Check: `health IN ('good', 'slow', 'blocked', 'unknown')`

**Indexes:**
- `proxies_pkey` (id)
- `proxies_soax_port_key` (soax_port)
- `idx_proxies_type` (type)
- `idx_proxies_health` (health)
- `idx_proxies_status` (status)
- `idx_proxies_last_rotated` (last_rotated)

---

#### 3. `phones` - GeeLark Cloud Phone Monitoring
**Purpose**: Tracks status and monitoring of GeeLark cloud phones

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `profile_id` | `text` | NO | - | Unique profile ID from GeeLark (PK) |
| `account_id` | `uuid` | YES | - | Associated account (FK to accounts, unique) |
| `battery` | `integer` | YES | - | Current battery percentage |
| `proxy_ip` | `text` | YES | - | Current proxy IP being used |
| `last_seen` | `timestamptz` | YES | - | Last status update timestamp |
| `status` | `text` | YES | `'unknown'` | Phone status |
| `version` | `text` | YES | - | GeeLark app version |
| `error_count` | `integer` | YES | `0` | Number of errors encountered |
| `meta` | `jsonb` | YES | `'{}'` | Additional metadata |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `profile_id`
- Unique: `account_id`
- Check: `status IN ('online', 'offline', 'error')`
- Foreign Key: `account_id` → `accounts(id)`

**Indexes:**
- `phones_pkey` (profile_id)
- `phones_account_id_key` (account_id)
- `idx_phones_account_id` (account_id)
- `idx_phones_status` (status)
- `idx_phones_last_seen` (last_seen)

---

#### 4. `posts` - Content Posts Tracking
**Purpose**: Tracks TikTok posts and their distribution status

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `account_id` | `uuid` | YES | - | Account used for posting (FK to accounts) |
| `asset_path` | `text` | NO | - | Path to video in Supabase Storage |
| `caption` | `text` | YES | - | Text caption for the post |
| `hashtags` | `text[]` | YES | - | Array of hashtags |
| `status` | `text` | YES | `'queued'` | Post status |
| `tiktok_post_id` | `text` | YES | - | TikTok post ID after successful posting |
| `task_id` | `text` | YES | - | GeeLark task ID for posting operation |
| `posted_at` | `timestamptz` | YES | - | When post was successfully published |
| `error_message` | `text` | YES | - | Error details if posting failed |
| `retry_count` | `integer` | YES | `0` | Number of posting attempts made |
| `meta` | `jsonb` | YES | `'{}'` | Additional metadata |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Check: `status IN ('queued', 'processing', 'posted', 'failed', 'cancelled')`
- Foreign Key: `account_id` → `accounts(id)`

**Indexes:**
- `posts_pkey` (id)
- `idx_posts_account_id` (account_id)
- `idx_posts_status` (status)
- `idx_posts_created_at` (created_at)

---

#### 5. `tasks` - GeeLark Task Management
**Purpose**: Tracks GeeLark API tasks and their execution status

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `geelark_task_id` | `text` | YES | - | Task ID from GeeLark API (unique) |
| `task_type` | `text` | NO | - | Type of task (warmup, post, etc) |
| `type` | `text` | YES | - | Standardized task type |
| `account_id` | `uuid` | YES | - | Associated account (FK to accounts) |
| `post_id` | `uuid` | YES | - | Related post if posting task (FK to posts) |
| `status` | `text` | YES | `'pending'` | Task status |
| `result` | `text` | YES | - | Task result data as JSON |
| `error_message` | `text` | YES | - | Error details if task failed |
| `completed_at` | `timestamptz` | YES | - | When the task completed |
| `meta` | `jsonb` | YES | `'{}'` | Additional metadata |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `geelark_task_id`
- Check: `status IN ('pending', 'running', 'completed', 'failed', 'cancelled')`
- Check: `type IN ('warmup', 'post', 'check_status', 'other')`
- Foreign Key: `account_id` → `accounts(id)`
- Foreign Key: `post_id` → `posts(id)`

**Indexes:**
- `tasks_pkey` (id)
- `tasks_geelark_task_id_key` (geelark_task_id)
- `idx_tasks_account_id` (account_id)
- `idx_tasks_status` (status)
- `idx_tasks_task_type` (task_type)
- `idx_tasks_type` (type)
- `idx_tasks_created_at` (created_at)

---

#### 6. `sms_rentals` - DaisySMS Phone Number Rentals
**Purpose**: Manages phone number rentals for TikTok verification

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `rental_id` | `text` | NO | - | Unique rental ID from daisySMS |
| `account_id` | `uuid` | YES | - | Associated account (FK to accounts) |
| `phone_number` | `text` | YES | - | Rented phone number |
| `country_code` | `text` | YES | - | Country code of phone number |
| `service` | `text` | YES | `'tiktok'` | Service being verified |
| `otp` | `text` | YES | - | One-time password received via SMS |
| `status` | `text` | YES | `'active'` | Rental status |
| `expires_at` | `timestamptz` | YES | - | Expiration timestamp for rental |
| `meta` | `jsonb` | YES | `'{}'` | Additional metadata |
| `created_at` | `timestamptz` | YES | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | YES | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `rental_id`
- Check: `status IN ('waiting', 'received', 'cancelled', 'expired')`
- Foreign Key: `account_id` → `accounts(id)`

**Indexes:**
- `sms_rentals_pkey` (id)
- `sms_rentals_daisy_id_key` (rental_id)
- `idx_sms_rentals_account_id` (account_id)
- `idx_sms_rentals_status` (status)
- `idx_sms_rentals_expires_at` (expires_at)

---

#### 7. `logs` - System Logging
**Purpose**: Centralized logging for the entire system

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `timestamp` | `timestamptz` | YES | `now()` | Log entry timestamp |
| `level` | `text` | NO | - | Log level |
| `component` | `text` | NO | - | System component that generated the log |
| `account_id` | `uuid` | YES | - | Related account (FK to accounts) |
| `message` | `text` | NO | - | Log message |
| `meta` | `jsonb` | YES | `'{}'` | Additional log metadata |

**Constraints:**
- Primary Key: `id`
- Check: `level IN ('debug', 'info', 'warning', 'error', 'critical')`
- Foreign Key: `account_id` → `accounts(id)`
- RLS: Enabled

**Indexes:**
- `logs_pkey` (id)
- `idx_logs_timestamp` (timestamp DESC)
- `idx_logs_level` (level)
- `idx_logs_account_id` (account_id)

---

### Template Gallery System

#### 8. `users` - User Management
**Purpose**: Manages authenticated users for the template gallery

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | - | Primary key (linked to auth.users) |
| `username` | `text` | YES | - | Unique username |
| `display_name` | `text` | YES | - | Display name |
| `avatar_url` | `text` | YES | - | Avatar image URL |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `username`
- Foreign Key: `id` → `auth.users(id)`

**Indexes:**
- `users_pkey` (id)
- `users_username_key` (username)

---

#### 9. `categories` - Template Categories
**Purpose**: Categorization system for templates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `integer` | NO | `nextval('categories_id_seq')` | Primary key |
| `name` | `text` | NO | - | Category name (unique) |
| `description` | `text` | YES | - | Category description |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `name`

**Indexes:**
- `categories_pkey` (id)
- `categories_name_key` (name)

---

#### 10. `template_gallery` - Template Gallery
**Purpose**: Stores user-generated content templates

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `name` | `text` | NO | - | Template name |
| `description` | `text` | YES | - | Template description |
| `category_id` | `integer` | YES | - | Category (FK to categories) |
| `author_id` | `uuid` | YES | - | Template author (FK to users) |
| `author_name` | `text` | YES | - | Author display name |
| `preview_image_url` | `text` | YES | - | Template preview image |
| `template_data` | `jsonb` | NO | - | Template configuration data |
| `slide_count` | `integer` | NO | `0` | Number of slides in template |
| `tags` | `text[]` | YES | `'{}'` | Template tags array |
| `downloads` | `integer` | NO | `0` | Download count |
| `likes` | `integer` | NO | `0` | Like count |
| `is_featured` | `boolean` | NO | `false` | Whether template is featured |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Foreign Key: `category_id` → `categories(id)`
- Foreign Key: `author_id` → `users(id)`

**Indexes:**
- `template_gallery_pkey` (id)
- `idx_template_gallery_category` (category_id)
- `idx_template_gallery_author` (author_id)
- `idx_template_gallery_downloads` (downloads)
- `idx_template_gallery_likes` (likes)
- `idx_template_gallery_featured` (is_featured)
- `idx_template_gallery_tags` (tags) - GIN index

---

#### 11. `user_template_interactions` - User Template Interactions
**Purpose**: Tracks user interactions with templates (likes, downloads)

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `uuid` | NO | `gen_random_uuid()` | Primary key |
| `user_id` | `uuid` | YES | - | User (FK to users) |
| `template_id` | `uuid` | YES | - | Template (FK to template_gallery) |
| `has_liked` | `boolean` | NO | `false` | Whether user liked the template |
| `has_downloaded` | `boolean` | NO | `false` | Whether user downloaded the template |
| `created_at` | `timestamptz` | NO | `now()` | Creation timestamp |
| `updated_at` | `timestamptz` | NO | `now()` | Last update timestamp |

**Constraints:**
- Primary Key: `id`
- Unique: `(user_id, template_id)`
- Foreign Key: `user_id` → `users(id)`
- Foreign Key: `template_id` → `template_gallery(id)`

**Indexes:**
- `user_template_interactions_pkey` (id)
- `user_template_interactions_user_id_template_id_key` (user_id, template_id)
- `idx_interactions_user` (user_id)
- `idx_interactions_template` (template_id)

---

## Database Features

### Triggers
All main tables have automatic `updated_at` timestamp triggers:
- `update_accounts_updated_at`
- `update_phones_updated_at`
- `update_proxies_updated_at`
- `update_sms_rentals_updated_at`
- `update_posts_updated_at`
- `update_tasks_updated_at`

### Row Level Security (RLS)
- **Enabled**: `logs` table only
- **Disabled**: All other tables (internal tool usage)

### Data Types
- **UUID**: Used for all primary keys (except `categories`)
- **JSONB**: Used for flexible metadata storage
- **TEXT[]**: Used for hashtags and tags arrays
- **TIMESTAMPTZ**: Used for all timestamps with timezone support

---

## Entity Relationships

### Core Distribution Flow
```
proxies ←→ accounts ←→ phones
    ↓           ↓
    ↓       sms_rentals
    ↓           ↓
    ↓       posts ←→ tasks
    ↓           ↓
    ↓       logs
```

### Template Gallery Flow
```
users ←→ template_gallery ←→ categories
  ↓              ↓
  ↓    user_template_interactions
```

### Key Relationships
1. **accounts** → **proxies** (many-to-one)
2. **phones** → **accounts** (one-to-one)
3. **posts** → **accounts** (many-to-one)
4. **tasks** → **accounts** (many-to-one)
5. **tasks** → **posts** (many-to-one, optional)
6. **sms_rentals** → **accounts** (many-to-one)
7. **logs** → **accounts** (many-to-one, optional)
8. **template_gallery** → **users** (many-to-one)
9. **template_gallery** → **categories** (many-to-one)
10. **user_template_interactions** → **users** + **template_gallery** (many-to-many bridge)

---

## Performance Considerations

### Indexing Strategy
- **Primary Keys**: All tables have UUID primary keys with B-tree indexes
- **Foreign Keys**: All foreign key columns are indexed
- **Status Fields**: All status/state columns are indexed for filtering
- **Timestamps**: Time-based queries are optimized with indexes
- **Search**: Template tags use GIN indexing for array searches

### Query Optimization
- **Composite Indexes**: User-template interactions use compound unique index
- **Partial Indexes**: Consider adding for common filtered queries
- **Materialized Views**: Could be added for heavy analytics queries

---

## Maintenance Notes

### Regular Maintenance Tasks
1. **Log Cleanup**: Implement log rotation for the `logs` table
2. **Proxy Health**: Monitor proxy health and rotation schedules
3. **Account Status**: Monitor account warmup progress and bans
4. **Task Cleanup**: Archive completed tasks older than X days
5. **SMS Rental Cleanup**: Clean up expired SMS rentals

### Monitoring Queries
```sql
-- Account status distribution
SELECT status, COUNT(*) FROM accounts GROUP BY status;

-- Active proxy health
SELECT health, COUNT(*) FROM proxies WHERE status = 'active' GROUP BY health;

-- Recent task failure rate
SELECT 
  status, 
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM tasks 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Top performing templates
SELECT name, downloads, likes 
FROM template_gallery 
ORDER BY (downloads + likes) DESC 
LIMIT 10;
``` 