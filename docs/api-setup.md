# API Configuration Guide

This document explains how to properly configure the APIs for DaisySMS, GeeLark, and SOAX based on their official documentation.

## Environment Variables

Create a `.env.local` file in your project root with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# DaisySMS Configuration
DAISYSMS_API_KEY=your_daisysms_api_key
DAISYSMS_API_BASE_URL=https://daisysms.com/stubs/handler_api.php

# GeeLark Configuration
GEELARK_API_KEY=your_geelark_api_key
GEELARK_API_BASE_URL=https://open.geelark.com
GEELARK_APP_ID=712TQBP6R582JGQ4YD6IL6T

# SOAX Configuration  
SOAX_API_KEY=your_soax_api_key
SOAX_API_BASE_URL=https://api.soax.com
SOAX_PACKAGE_KEY=280253
SOAX_POOL_HOST=your_soax_proxy_host
SOAX_POOL_PORT=your_soax_proxy_port
```

## API Authentication Methods

### DaisySMS
- **Method**: URL parameters
- **Authentication**: API key as query parameter
- **Example**: `https://daisysms.com/stubs/handler_api.php?api_key=YOUR_KEY&action=getBalance`

### GeeLark
- **Method**: POST with JSON body
- **Authentication**: API key and App ID in request body
- **Important**: All GeeLark API calls use POST method, even for data retrieval
- **Example request body**:
```json
{
  "api_key": "your_api_key",
  "app_id": "your_app_id",
  "page": 1,
  "page_size": 10
}
```

### SOAX
- **Method**: Bearer token authentication
- **Authentication**: `Authorization: Bearer YOUR_API_KEY`
- **Base URL**: Usually `https://api.soax.com/v1`
- **Package Key**: Used for proxy authentication and API calls

## Common Issues and Solutions

### GeeLark Authentication Failures
1. **Issue**: "404 page not found" 
   **Solution**: Wrong API base URL. Try these alternatives:
   - `https://open.geelark.com` (dashboard domain)
   - `https://api.geelark.com` (API domain)
   - `https://geelark.com` (main domain)

2. **Issue**: "Unexpected token p in JSON at position 4"
   **Solution**: The API is returning a non-JSON error message. Check your API key and App ID credentials.

3. **Issue**: Using GET method or Bearer tokens
   **Solution**: Use POST method with JSON body containing `api_key` and `app_id`

4. **Issue**: Wrong endpoint paths
   **Solution**: Try both `/api/v1/` and `/openapi/v1/` prefixes

5. **Issue**: "permission denied" or similar text responses
   **Solution**: Verify your API key has the correct permissions and the App ID is valid

### SOAX Authentication Failures
1. **Issue**: "no Route matched with those values" or 404 errors
   **Solution**: Wrong API base URL or endpoint. Try these alternatives:
   - `https://api.soax.com` 
   - `https://panel.soax.com/api`
   - `https://dashboard.soax.com/api`
   - Endpoints: `/v1/packages/{PACKAGE_KEY}/stats` or `/packages/{PACKAGE_KEY}/stats`

2. **Issue**: Package key from proxy details (280253)
   **Solution**: Use the package key from your proxy configuration, not from dashboard

3. **Issue**: 401/403 errors
   **Solution**: Check your API key and ensure your package is active and has permissions

4. **Issue**: "Invalid credentials format"
   **Solution**: Ensure package key matches the one from your proxy details

### General Debugging
1. Check the Settings page for real-time API test results
2. Verify all environment variables are properly set
3. Ensure API keys have the correct permissions
4. Check rate limits and usage quotas

## Testing APIs

Use the Settings page in the application to test all APIs:
1. Navigate to `/settings`
2. Click "Run All Tests" or test individual services
3. Check the detailed results for any failures
4. View response timing and error messages

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Rotate API keys regularly
- Monitor API usage and rate limits
- Implement proper error handling for production use 