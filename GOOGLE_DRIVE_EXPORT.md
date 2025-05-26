# Google Drive Export Feature

This document describes the Google Drive export functionality for carousel assets in the Spectre application.

## Overview

The Google Drive export feature allows users to export completed carousel variants directly to their Google Drive account. This feature is optional and only requires Google authentication when a user wants to export assets.

## Features

- **OAuth 2.0 Authentication**: Secure Google sign-in flow
- **Selective Export**: Export individual carousel variants or entire jobs
- **Folder Organization**: Maintains proper folder hierarchy in Google Drive
- **Progress Tracking**: Real-time upload progress with visual feedback
- **Token Management**: Automatic token refresh for seamless experience

## User Flow

1. **Navigate to Assets Tab**: Go to the Assets page to view completed carousels
2. **Expand a Job**: Click on any completed job to see its variants
3. **Export Options**:
   - Click the upload icon on any variant to export that specific variant
   - Click "Export All to Google Drive" to export the entire job with all variants
4. **Google Authentication** (first time only):
   - Click "Sign in with Google" in the modal
   - Authorize the app to access Google Drive
   - You'll be redirected back to the Assets page
5. **Export Process**:
   - Review export details
   - Click "Export to Drive" to start the upload
   - Monitor progress in real-time
   - Files are uploaded with proper folder structure

## Folder Structure in Google Drive

### For Individual Variant Export:
```
[Job Name] - Variant [Number]/
  ├── slide_1.png
  ├── slide_2.png
  └── ...
```

### For Full Job Export:
```
[Job Name]/
  ├── Variant 1/
  │   ├── slide_1.png
  │   ├── slide_2.png
  │   └── ...
  ├── Variant 2/
  │   ├── slide_1.png
  │   ├── slide_2.png
  │   └── ...
  └── ...
```

## Technical Implementation

### Components

1. **GoogleAuthService** (`lib/services/google-auth.ts`):
   - Handles OAuth 2.0 flow
   - Manages access and refresh tokens
   - Provides user authentication status

2. **GoogleDriveService** (`lib/services/google-drive.ts`):
   - Creates folders in Google Drive
   - Uploads files with proper metadata
   - Handles batch exports with progress tracking

3. **GoogleDriveExportModal** (`components/GoogleDriveExportModal.tsx`):
   - User interface for the export process
   - Shows authentication status
   - Displays upload progress

### API Routes

- `/api/auth/google/callback`: Handles OAuth callback and token exchange
- `/api/auth/google/refresh`: Refreshes expired access tokens

### Environment Variables

Add these to your `.env.local`:
```
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
```

## Security Considerations

- Access tokens are stored in localStorage with expiry tracking
- Refresh tokens are used to maintain long-term access
- The app only requests necessary Google Drive scopes:
  - `drive.file`: Create and manage files created by the app
  - `drive.metadata.readonly`: List folders for organization
  - `userinfo.email` and `userinfo.profile`: Display user information

## Troubleshooting

### Common Issues

1. **Authentication Failed**: 
   - Ensure Google OAuth credentials are correctly configured
   - Check redirect URI matches your application URL

2. **Upload Errors**:
   - Verify internet connection
   - Check if Google Drive has sufficient storage
   - Ensure images are accessible from their storage URLs

3. **Token Expired**:
   - The app automatically refreshes tokens
   - If issues persist, sign out and sign in again

### Debugging

- Check browser console for detailed error messages
- Verify OAuth callback URL matches configuration
- Ensure all environment variables are set correctly 