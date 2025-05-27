# SPECTRE - Master Documentation

## Table of Contents
1. [Overview](#overview)
2. [What is SPECTRE?](#what-is-spectre)
3. [Core Purpose](#core-purpose)
4. [Architecture](#architecture)
5. [Key Features](#key-features)
6. [Integrations](#integrations)
7. [Workflow](#workflow)
8. [Technical Stack](#technical-stack)
9. [Security](#security)
10. [Getting Started](#getting-started)

## Overview

SPECTRE (Advanced Cloud Operations Control Center) is a sophisticated web application designed to automate and manage large-scale social media content distribution, specifically targeting TikTok through cloud-based Android phone emulation. It combines AI-powered content generation, proxy management, SMS verification, and automated posting capabilities into a unified platform.

## What is SPECTRE?

SPECTRE is an enterprise-grade automation platform that:

- **Manages Virtual Android Devices**: Controls hundreds of cloud-based Android phones through GeeLark integration
- **Generates AI Content**: Creates carousel images with anti-shadowban technology using OpenAI
- **Automates Social Media Posting**: Distributes content across multiple TikTok accounts automatically
- **Handles Verification**: Manages SMS verification for account creation and security
- **Maintains Account Health**: Implements warm-up sequences and proxy rotation to prevent detection

## Core Purpose

SPECTRE solves the complex challenge of managing multiple social media accounts at scale while maintaining account health and avoiding platform detection. It's designed for:

1. **Marketing Agencies**: Managing content distribution for multiple clients
2. **Content Creators**: Scaling content across multiple accounts
3. **Growth Marketers**: Testing content variations and strategies at scale
4. **Social Media Managers**: Automating repetitive posting tasks

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Profiles │ │ Assets  │ │  Tasks  │ │Settings │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js API)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ GeeLark  │ │   SOAX   │ │ DaisySMS │ │  OpenAI  │      │
│  │   API    │ │   API    │ │   API    │ │   API    │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer (Supabase)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │PostgreSQL│ │ Storage  │ │   Auth   │ │   Edge   │      │
│  │    DB    │ │  Bucket  │ │  System  │ │Functions │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

Key tables include:
- `accounts` - TikTok accounts and credentials
- `phones` - GeeLark virtual device information
- `proxies` - Proxy configurations (sticky/SIM)
- `sms_rentals` - Phone number rentals for verification
- `posts` - Content distribution queue
- `tasks` - Automation task tracking
- `image_generation_jobs` - AI content generation jobs
- `carousel_variants` - Generated content variants
- `logs` - Comprehensive activity logging

## Key Features

### 1. Profile Management
- **Virtual Device Control**: Create and manage GeeLark Android profiles
- **Automated Warm-up**: Intelligent warm-up sequences to establish account credibility
- **Status Monitoring**: Real-time device and account health tracking
- **Bulk Operations**: Manage hundreds of profiles simultaneously

### 2. Content Generation System
- **AI-Powered Creation**: Uses OpenAI to generate carousel images
- **Anti-Shadowban Technology**: Advanced image processing to avoid detection
  - Metadata manipulation
  - Dynamic borders and fractures
  - Color shifting and micro-noise
  - Invisible watermarking
- **Variant System**: Generate up to 500 variants per job
- **Smart Text Replacement**: Simplified prompt system for text overlays

### 3. Proxy Management
- **Dual Proxy Types**:
  - Sticky proxies for warm-up phases
  - SIM proxies for production posting
- **Automatic Rotation**: Scheduled proxy rotation to maintain freshness
- **Health Monitoring**: Continuous proxy health checks
- **IP Whitelisting**: Automatic IP management for GeeLark

### 4. SMS Verification System
- **DaisySMS Integration**: Automated phone number rental
- **OTP Polling**: Automatic verification code retrieval
- **72-Hour Rentals**: Extended rental periods for account stability
- **Concurrent Support**: Handle up to 20 simultaneous verifications

### 5. Content Distribution
- **Agency Workflow**: Organize content by creator for agency distribution
- **Carousel Posting**: Automated TikTok carousel uploads
- **Task Queue**: Intelligent queue management with retry logic
- **Performance Tracking**: Monitor post success rates and engagement

### 6. Export & Integration
- **Google Drive Export**: Direct export to organized Drive folders
- **Batch Downloads**: ZIP file generation for local storage
- **API Access**: RESTful APIs for external integrations

## Integrations

### GeeLark
- Cloud-based Android emulation platform
- Provides virtual devices for automation
- Supports proxy configuration and app control
- Real-time device status and screenshots

### SOAX
- Premium proxy provider
- Sticky session proxies for consistency
- Mobile SIM proxies for authenticity
- Global proxy pool access

### DaisySMS
- SMS verification service
- Temporary phone number rentals
- OTP code retrieval API
- Multiple country support

### OpenAI
- GPT-4 for content generation
- DALL-E for image creation
- Smart prompt optimization
- Batch processing support

### Google Services
- OAuth 2.0 authentication
- Drive API for cloud storage
- Folder organization and sharing

## Workflow

### Typical Usage Flow

1. **Setup Phase**
   ```
   Create Profile → Assign Sticky Proxy → Run Warm-up → Switch to SIM Proxy
   ```

2. **Content Creation**
   ```
   Upload Template → Generate Variants → Apply Anti-Shadowban → Store in Cloud
   ```

3. **Distribution**
   ```
   Select Profiles → Assign Content → Queue Tasks → Monitor Progress
   ```

4. **Maintenance**
   ```
   Monitor Health → Rotate Proxies → Check Logs → Export Reports
   ```

### Automation Sequences

#### Profile Warm-up
1. Create new GeeLark profile
2. Assign sticky proxy
3. Install TikTok app
4. Run warm-up automation (browse, like, follow)
5. Graduate to production status

#### Content Posting
1. Profile requests carousel variant
2. System assigns unposted variant
3. GeeLark uploads to TikTok
4. System marks variant as posted
5. Track performance metrics

## Technical Stack

### Frontend
- **Framework**: Next.js 15.3.2 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4
- **UI Components**: Custom components with Lucide icons
- **State Management**: React Context API
- **Animations**: Framer Motion

### Backend
- **Runtime**: Node.js with Next.js API routes
- **Database**: PostgreSQL via Supabase
- **Storage**: Supabase Storage buckets
- **Authentication**: Supabase Auth
- **Image Processing**: Sharp library

### Infrastructure
- **Hosting**: Vercel
- **Database**: Supabase (PostgreSQL)
- **CDN**: Vercel Edge Network
- **Cron Jobs**: Vercel Cron
- **Monitoring**: Built-in logging system

### Key Dependencies
- `@supabase/supabase-js` - Database and auth
- `openai` - AI content generation
- `sharp` - Image processing
- `jszip` - File compression
- `xlsx` - Data export
- `date-fns` - Date manipulation

## Security

### Authentication & Authorization
- Supabase Auth with email/password
- Row Level Security (RLS) on all tables
- Service role keys for server-side operations
- Session-based authentication

### Data Protection
- Environment variables for sensitive data
- Encrypted storage for credentials
- Secure API endpoints with middleware
- HTTPS enforcement

### Account Safety
- Anti-detection measures
- Proxy rotation strategies
- Human-like behavior patterns
- Rate limiting and delays

## Getting Started

### Prerequisites
- Node.js 18+
- Supabase account
- GeeLark account
- SOAX proxy subscription
- DaisySMS API access
- OpenAI API key

### Quick Start
1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Fill in all required credentials
4. Install dependencies: `npm install`
5. Run migrations in Supabase
6. Start development: `npm run dev`

### Configuration
See `SETUP.md` for detailed setup instructions including:
- Database migration steps
- Storage bucket configuration
- Authentication setup
- Initial data seeding

### Deployment
1. Push to GitHub
2. Connect to Vercel
3. Configure environment variables
4. Deploy with automatic builds

## Advanced Features

### Anti-Shadowban System
SPECTRE implements sophisticated techniques to avoid platform detection:
- **Metadata Spoofing**: Mimics real device EXIF data
- **Visual Modifications**: Subtle changes to make each image unique
- **Behavioral Patterns**: Human-like posting schedules
- **Proxy Diversity**: Different IPs for each account

### Scaling Capabilities
- Handle 500+ profiles simultaneously
- Generate thousands of content variants
- Process multiple campaigns in parallel
- Automatic resource management

### Monitoring & Analytics
- Real-time task status updates
- Comprehensive error logging
- Performance metrics tracking
- Export capabilities for reporting

## Future Roadmap

Planned enhancements include:
- Multi-platform support (Instagram, YouTube Shorts)
- Advanced analytics dashboard
- AI-powered content optimization
- Automated A/B testing
- Enhanced anti-detection algorithms
- Mobile app for monitoring

## Conclusion

SPECTRE represents a comprehensive solution for scaled social media automation, combining cutting-edge AI technology with robust infrastructure to deliver enterprise-grade content distribution capabilities. Its modular architecture and extensive feature set make it suitable for agencies, creators, and marketers looking to maximize their social media presence efficiently and safely. 