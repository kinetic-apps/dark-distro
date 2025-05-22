# API Configuration Guide

This document explains how to properly configure the APIs for DaisySMS, GeeLark, and SOAX based on their official documentation and actual implementation requirements.

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

# GeeLark Configuration (Signature-based Authentication)
GEELARK_API_KEY=your_geelark_api_key
GEELARK_API_BASE_URL=https://openapi.geelark.com
GEELARK_APP_ID=your_geelark_app_id

# SOAX Configuration (Proxy Service - NOT REST API)
SOAX_PACKAGE_KEY=your_numeric_package_key
SOAX_POOL_HOST=proxy.soax.com
SOAX_POOL_PORT=5000
```

## API Authentication Methods

### DaisySMS
- **Method**: URL parameters
- **Authentication**: API key as query parameter
- **Example**: `https://daisysms.com/stubs/handler_api.php?api_key=YOUR_KEY&action=getBalance`

### GeeLark (Complex Signature-Based Authentication)
- **Method**: POST with signature-based headers
- **Base URL**: `https://openapi.geelark.com`
- **Required Headers**:
  - `appId`: Team AppId
  - `traceId`: Unique request ID (UUID v4)
  - `ts`: Timestamp in milliseconds
  - `nonce`: Random number (first 6 characters of traceId)
  - `sign`: SHA256 signature

- **Signature Generation**:
  1. Concatenate: `TeamAppId + traceId + ts + nonce + TeamApiKey`
  2. Generate SHA256 hexadecimal uppercase digest

- **Example Implementation**:
```javascript
const timestamp = new Date().getTime().toString()
const traceId = generateUUID() // UUID v4
const nonce = traceId.substring(0, 6)
const signString = APP_ID + traceId + timestamp + nonce + API_KEY
const sign = createHash('sha256').update(signString).digest('hex').toUpperCase()

const headers = {
  'Content-Type': 'application/json',
  'appId': APP_ID,
  'traceId': traceId,
  'ts': timestamp,
  'nonce': nonce,
  'sign': sign,
}
```

### SOAX (Proxy Service - NOT REST API)
- **Service Type**: Proxy service with credential-based authentication
- **Endpoint**: `proxy.soax.com:5000`
- **Authentication Format**: `package-{package_id}-sessionid-{session}:{package_key}`
- **Geographic Targeting**: `package-{package_id}-country-{cc}-sessionid-{session}:{package_key}`

- **Example Proxy Credentials**:
```
Host: proxy.soax.com
Port: 5000
Username: package-280253-sessionid-session123
Password: 280253
```

## API Endpoints and Usage

### GeeLark Endpoints
- **Phone List**: `POST /open/v1/phone/list`
- **Success Response**: `{ "code": 0, "data": {...} }`
- **Error Response**: `{ "code": non-zero, "msg": "error message" }`

### SOAX Configuration
- **NOT a REST API** - It's a proxy service
- **Package Key**: Must be numeric (from your SOAX dashboard)
- **Session Management**: Use unique session IDs for different connections
- **Geographic Targeting**: Optional country/city/ISP targeting

## Common Issues and Solutions

### GeeLark Authentication Failures
1. **Issue**: "HTTP 404: 404 page not found"
   **Solution**: Wrong base URL. Use `https://openapi.geelark.com` (not `https://open.geelark.com`)

2. **Issue**: "GeeLark error (40003): Signature verification failed"
   **Solution**: Check signature generation - ensure correct order: `appId + traceId + ts + nonce + apiKey`

3. **Issue**: "GeeLark error (40002): The traceId in the request header cannot be empty"
   **Solution**: Ensure proper UUID v4 generation for traceId

4. **Issue**: Timestamp issues
   **Solution**: Use `new Date().getTime().toString()` for millisecond timestamp

5. **Issue**: Wrong endpoint
   **Solution**: Use `/open/v1/phone/list` not `/api/v1/profile/list`

### SOAX Configuration Issues
1. **Issue**: "SOAX package key not configured"
   **Solution**: Ensure SOAX_PACKAGE_KEY is set and numeric (e.g., "280253")

2. **Issue**: "Invalid SOAX package key format"
   **Solution**: Package key should be numeric only (no letters or special characters)

3. **Issue**: Cannot test actual proxy connectivity
   **Solution**: SOAX is a proxy service - actual testing requires network configuration and proxy client setup

4. **Issue**: Confusion about API endpoints
   **Solution**: SOAX doesn't have REST API endpoints - it's a proxy service with credential-based authentication

### DaisySMS Issues
1. **Issue**: API key validation
   **Solution**: Check your DaisySMS dashboard for the correct API key

2. **Issue**: Rate limiting
   **Solution**: Implement proper delays between requests

## Environment Variable Examples

Based on your dashboard information:

```bash
# GeeLark (from your dashboard screenshot)
GEELARK_API_KEY=your_actual_api_key_from_dashboard
GEELARK_API_BASE_URL=https://openapi.geelark.com
GEELARK_APP_ID=712TQBP6R582JGQ4YD6IL6T

# SOAX (from your proxy details)
SOAX_PACKAGE_KEY=280253
SOAX_POOL_HOST=proxy.soax.com
SOAX_POOL_PORT=5000
```

## Testing APIs

Use the Settings page in the application to test all APIs:
1. Navigate to `/settings`
2. Click "Run All Tests" or test individual services
3. Check the detailed results for any failures
4. Review response timing and error messages

## Key Differences from Initial Implementation

1. **GeeLark**: Completely different authentication - uses signature-based headers, not JSON body with API keys
2. **SOAX**: Not a REST API at all - it's a proxy service with credential-based authentication
3. **Base URLs**: GeeLark uses `openapi.geelark.com`, not `open.geelark.com`
4. **Response Codes**: GeeLark uses `code: 0` for success, not `code: 200`

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- GeeLark signatures include timestamp to prevent replay attacks
- SOAX package keys should be kept secure as they provide proxy access
- Monitor API usage and rate limits
- Implement proper error handling for production use 