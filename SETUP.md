# Spectre Setup Guide

## Prerequisites

- Node.js 18+ and npm
- Supabase account
- GeeLark account
- DaisySMS account
- Vercel account (for deployment)

## Initial Setup

### 1. Clone and Install

```bash
git clone [repository-url]
cd spectre
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in all required values:

```bash
cp .env.example .env.local
```

### 3. Database Setup

1. Create a new Supabase project
2. Run the migrations in order from `supabase/migrations/`
3. Enable Row Level Security (RLS) on all tables
4. Set up storage buckets:
   - `screenshots` (public)
   - `assets` (public)
   - `exports` (private)

### 4. Authentication Setup

1. In Supabase Dashboard, go to Authentication > Providers
2. Enable Email provider
3. Configure Google OAuth (optional)
4. Add your domain to the redirect URLs

## Development

```bash
npm run dev
```

Visit `http://localhost:3000`

## Testing the Setup

### 1. Create Test Data

After setting up, you can add test data to verify everything works:

```sql
-- Add test proxies (these will be replaced by GeeLark sync)
INSERT INTO proxies (geelark_id, scheme, server, port, username, password, group_name, is_active)
VALUES 
  ('test-1', 'socks5', 'proxy.example.com', 9000, 'user1', 'pass1', 'residential', true),
  ('test-2', 'socks5', 'proxy.example.com', 9001, 'user2', 'pass2', 'mobile', true);

-- Add proxy group settings
INSERT INTO proxy_group_settings (group_name, allowed_for_phone_creation, priority)
VALUES 
  ('residential', true, 1),
  ('mobile', true, 2),
  ('datacenter', false, 3);
```

### 2. Verify Integrations

1. **GeeLark**: Test connection at `/api/geelark/test-auth`
2. **DaisySMS**: Test connection at `/api/daisysms/test-auth`
3. **Proxy Sync**: Manually trigger at `/api/geelark/sync-proxies-from-geelark`

### 3. Create Your First Profile

1. Navigate to `/profiles/new`
2. Fill in device details
3. Select proxy configuration (auto-assign recommended)
4. Submit to create a new GeeLark profile

## Deployment

### Vercel Deployment

1. Push to GitHub
2. Import project in Vercel
3. Add all environment variables
4. Deploy

### Post-Deployment

1. Update `NEXT_PUBLIC_APP_URL` to your production URL
2. Add production domain to Supabase redirect URLs
3. Test all integrations in production

## Troubleshooting

### Common Issues

1. **Database connection errors**: Check Supabase service role key
2. **GeeLark API errors**: Verify API key and check GeeLark account status
3. **Proxy sync not working**: Ensure GeeLark has proxies configured
4. **SMS verification failing**: Check DaisySMS balance and API key

### Logs

- Check browser console for client-side errors
- View server logs in Vercel dashboard
- Database logs available in Supabase dashboard

## Maintenance

### Regular Tasks

1. Monitor proxy sync status
2. Clean up old screenshots (30+ days)
3. Review error logs weekly
4. Update dependencies monthly

### Backup

1. Export Supabase data regularly
2. Backup environment variables
3. Document any custom configurations