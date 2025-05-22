# Dark Distro - TikTok Cloud Phone Control Center

A Next.js 14 web application for managing TikTok cloud phone farms with GeeLark, SOAX proxies, and DaisySMS integration.

## Architecture

- **Frontend**: Next.js 14 (App Router) with TypeScript
- **Styling**: Tailwind CSS (grayscale theme)
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth
- **Deployment**: Vercel

## Features

### Profile Management
- Create and manage GeeLark Android phone profiles
- Automated warm-up sequences
- Proxy assignment and rotation
- Real-time device status monitoring

### Proxy Management
- SOAX sticky pool integration for warm-up
- Dedicated SIM proxies for posting
- Health monitoring and automatic rotation
- IP whitelisting support

### SMS Verification
- DaisySMS integration for OTP codes
- Automatic polling for verification codes
- Support for up to 20 concurrent rentals
- 72-hour rental periods

### Content Distribution
- Automatic asset detection from Supabase Storage
- Batch posting campaigns
- Task queue management
- Success/failure tracking

### Monitoring & Logs
- Comprehensive logging system
- Real-time error tracking
- Export functionality
- Component-level filtering

## Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your credentials
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run database migrations in Supabase
5. Start the development server:
   ```bash
   npm run dev
   ```

## Environment Variables

See `.env.example` for required environment variables:
- Supabase credentials
- GeeLark API keys
- SOAX proxy credentials
- DaisySMS API key

## API Integrations

### GeeLark
- Profile creation and management
- Automation task execution
- Device status monitoring
- Proxy configuration

### SOAX
- Sticky session proxies
- Dedicated SIM proxies
- IP rotation (where supported)
- Health checking

### DaisySMS
- Phone number rental
- OTP code retrieval
- Rental management

## Database Schema

The application uses the following main tables:
- `accounts` - TikTok accounts and profiles
- `phones` - GeeLark device information
- `proxies` - Proxy configurations
- `sms_rentals` - Phone number rentals
- `posts` - Content distribution queue
- `tasks` - GeeLark automation tasks
- `logs` - System activity logs

## Cron Jobs

Configured in `vercel.json`:
- Task status polling: Every 2 minutes
- Nightly proxy rotation: Daily at 00:30

## Deployment

Deploy to Vercel:
```bash
vercel
```

Configure environment variables in Vercel dashboard.

## Usage

1. **Create Profiles**: Start by creating new GeeLark profiles
2. **Warm-up**: Run warm-up automation on new profiles
3. **Assign Proxies**: Assign dedicated proxies to warmed-up accounts
4. **Upload Content**: Upload videos to Supabase Storage
5. **Launch Campaigns**: Distribute content to active profiles

## Security

- Row Level Security (RLS) enabled on all tables
- Service role key used only for server-side operations
- Authentication required for all routes
- Sensitive data stored as environment variables