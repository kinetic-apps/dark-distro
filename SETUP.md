# Setup Guide for SPECTRE

## Prerequisites

- Node.js 18+ installed
- Supabase project created
- GeeLark, SOAX, and DaisySMS accounts set up

## Step-by-Step Setup

### 1. Environment Configuration

Your `.env.local` file is already configured with the necessary credentials. No changes needed here.

### 2. Database Migration

Since your tables already exist, you need to run the migration to add missing columns and constraints:

1. Go to your Supabase Dashboard > SQL Editor
2. Run the following migrations in order:
   - `/supabase/migrations/002_rpc_functions.sql` (creates the increment function)
   - `/supabase/migrations/003_add_missing_elements.sql` (adds missing columns and constraints)

### 3. Supabase Storage Setup

1. In Supabase Dashboard, go to Storage
2. Ensure you have a bucket named `ghostpost-outbox` (should already exist)
3. Make sure the bucket is private (not public)

### 4. Authentication Setup

1. In Supabase Dashboard, go to Authentication > Providers
2. Enable Email authentication if not already enabled
3. Create a user account for yourself:
   - Go to Authentication > Users
   - Click "Add user"
   - Enter your email and password

### 5. Local Development

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3000 in your browser

4. Sign in with the account you created in step 4

### 6. Initial Data Setup (Optional)

If you want to add some test proxies manually:

```sql
-- Add test SOAX proxies
INSERT INTO proxies (label, type, host, port, username, password, health)
VALUES 
  ('Sticky-Test-1', 'sticky', 'proxy.soax.com', 9000, 'test-user', 'test-pass', 'unknown'),
  ('SIM-Test-1', 'sim', 'us5.sim.soax.com', 12000, 't31S07sq7dYC3SkE', 'mobile;;;;', 'unknown'),
  ('SIM-Test-2', 'sim', 'us5.sim.soax.com', 12001, 't31S07sq7dYC3SkE', 'mobile;;;;', 'unknown');
```

### 7. Test the Application

1. **Create a Profile**: Go to Profiles > New Profile
2. **Check Logs**: Go to Logs to see if operations are being logged correctly
3. **Test SMS**: Try renting a number in the SMS section
4. **Upload Test Video**: Upload a test MP4 to the `ghostpost-outbox` bucket via Supabase Dashboard

### 8. Troubleshooting

If you encounter issues:

1. **Database errors**: Check the browser console and Supabase logs
2. **API errors**: Check the Logs page in the app
3. **Authentication issues**: Ensure your Supabase URL and keys are correct
4. **Storage issues**: Verify the bucket name and permissions

### 9. Production Deployment

When ready to deploy:

1. Push to GitHub
2. Deploy to Vercel:
   ```bash
   vercel
   ```
3. Add environment variables in Vercel dashboard
4. The cron jobs will automatically start running based on `vercel.json`

## Notes

- The `rental_id` column was renamed from `daisy_id` in the migration
- The `asset_path` column was renamed from `video_path` in the migration
- All tables now have `meta` JSONB columns for flexible data storage
- All tables now have proper `updated_at` triggers
- The logs table was created fresh as it didn't exist before