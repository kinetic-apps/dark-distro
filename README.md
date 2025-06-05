# Spectre

A Next.js 14 web application for managing advanced cloud phone operations with GeeLark and DaisySMS integration.

## Features

- **Cloud Phone Management**: Create and manage virtual Android devices via GeeLark
- **TikTok Automation**: Automated account creation, warm-up, and content posting
- **SMS Verification**: Integrated DaisySMS for phone number rentals and OTP handling
- **Content Generation**: AI-powered carousel and video creation
- **Task Scheduling**: Automated workflows with real-time monitoring
- **Profile Management**: Bulk operations and status tracking
- **Proxy Management**: Group-based proxy filtering and assignment
- **Screenshot Capture**: Real-time device screenshots
- **Analytics Dashboard**: Performance metrics and system health monitoring

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth with Google OAuth
- **Cloud Phones**: GeeLark API integration
- **SMS Service**: DaisySMS API
- **AI Services**: OpenAI GPT-4, Google Gemini
- **Deployment**: Vercel

## Prerequisites

- Node.js 18+
- Supabase account
- GeeLark account
- DaisySMS account
- OpenAI API key
- Google Cloud account (for Gemini)

## Environment Variables

Create a `.env.local` file with the following variables:

```bash
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# GeeLark
GEELARK_API_KEY=your_geelark_api_key
GEELARK_API_BASE_URL=https://api.geelark.com

# DaisySMS
DAISYSMS_API_KEY=your_daisysms_api_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Google Gemini
GOOGLE_GEMINI_API_KEY=your_gemini_api_key

# Storage
STORAGE_BUCKET_NAME=your_storage_bucket
```

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables
4. Run database migrations
5. Start development server: `npm run dev`

## Key Features

### Profile Management
- Create and manage TikTok profiles
- Bulk operations (start/stop phones, warmup, content posting)
- Real-time status tracking
- Tag-based organization

### Proxy System
- Automatic proxy synchronization from GeeLark
- Group-based proxy management
- Configurable allowed groups for phone creation
- Priority-based proxy assignment

### Content Creation
- AI-powered carousel generation with multiple variants
- Video upload and posting
- Scheduled content distribution

### Automation Workflows
- SMS-based TikTok account setup
- Email/password credential-based setup
- Automated warmup sequences
- Engagement automation (likes, comments)

## Scheduled Tasks

- **Task Status Updates**: Every 2 minutes
- **Warmup Progress**: Every minute
- **Proxy Sync**: Every 5 minutes

## License

Private - All rights reserved