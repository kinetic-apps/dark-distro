# TikTok Account Credentials Documentation

## Overview
This document outlines the credential strategy for TikTok accounts created through our SMS automation flow.

## Username Format
All automatically created TikTok accounts use the following username format:
- **Pattern**: `spectre_XXXXXX`
- **Example**: `spectre_a8k2df`
- **Character Set**: Lowercase letters and numbers only
- **Length**: 6 random characters after the prefix

## Password Strategy
All SMS-created TikTok accounts use a shared password for simplicity and consistency:
- **Password**: `Kinetic#2025!Auto`
- **Location**: Defined in `lib/constants/auth.ts`
- **Security**: 
  - 17 characters long
  - Contains uppercase, lowercase, numbers, and special characters
  - Meets all TikTok password requirements

## Geelark Integration
When creating accounts via Geelark RPA, the following parameters are passed:
- `${accountId}` - The UUID of the account
- `${username}` - The generated username (e.g., `spectre_a8k2df`)
- `${password}` - The shared password (`Kinetic#2025!Auto`)

## Database Storage
- **Username**: Stored in `accounts.tiktok_username` column
- **Password**: Not stored directly (all accounts use the shared password)
- **Password Type**: Stored as `password_type: 'shared_automation'` in account metadata

## Security Considerations
1. The shared password is only used for automated test accounts
2. Never use this password for personal or production accounts
3. The password is hardcoded to prevent accidental exposure in logs
4. Accounts created via email/password flow use different credentials

## Updating the Password
If you need to change the shared password:
1. Update `TIKTOK_AUTOMATION_PASSWORD` in `lib/constants/auth.ts`
2. Ensure the new password meets TikTok's requirements:
   - Minimum 8 characters
   - Mix of letters, numbers, and symbols
3. Update this documentation
4. Note: This will only affect newly created accounts 