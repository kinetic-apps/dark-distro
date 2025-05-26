# SOAX Proxy Integration Guide

## Overview

This system integrates SOAX proxy services for managing proxy connections used by GeeLark profiles. SOAX provides three types of proxies:

1. **Sticky Proxies** - Maintain the same IP for a session duration
2. **Rotating Proxies** - Change IP on each request
3. **SIM Proxies** - Mobile network proxies with dedicated ports

## Configuration

### Environment Variables

```env
# SOAX API Configuration
SOAX_API_BASE_URL=https://api.soax.com/v1
SOAX_API_KEY=your_api_key
SOAX_PACKAGE_KEY=your_package_key

# Proxy Endpoints
SOAX_POOL_HOST=proxy.soax.com
SOAX_POOL_PORT=9000          # Sticky proxy port
SOAX_ROTATING_PORT=6000      # Rotating proxy port

# SIM Proxy Configuration
SOAX_SIM_HOST=us5.sim.soax.com
SOAX_SIM_USERNAME=your_sim_username
SOAX_SIM_PASSWORD=your_sim_password
```

## Features

### 1. Import Proxies

The system can import SOAX proxies into the local database:

- Navigate to `/proxies` page
- Click "Import Proxies" button
- Select proxy type to import (All, Sticky, Rotating, or SIM)
- Proxies will be created with proper authentication credentials

### 2. Proxy Management

#### Sticky Proxies
- Username format: `package-{PACKAGE_KEY}-sessionid-{SESSION_ID}`
- Password: `{PACKAGE_KEY}`
- Can be rotated to get a new IP address
- Session IDs are automatically generated

#### Rotating Proxies
- Username format: `{PACKAGE_KEY}`
- Password: `{PACKAGE_KEY}`
- IP changes on each request
- Cannot be manually rotated

#### SIM Proxies
- Use dedicated credentials from environment variables
- Fixed ports (5000-5004 by default)
- Cannot be rotated via API

### 3. Health Monitoring

The system automatically checks proxy health:
- **Good** - Proxy is working correctly
- **Slow** - Proxy is responding slowly
- **Blocked** - Proxy is blocked or not responding
- **Unknown** - Health status not yet checked

### 4. Proxy Assignment

Proxies can be assigned to GeeLark profiles:
- When creating a new profile, select "Assign Proxy"
- Choose between Sticky or SIM proxy types
- Proxy credentials are automatically configured in GeeLark

## API Endpoints

### POST /api/soax/sync-proxies
Import SOAX proxies into the database.

**Request Body:**
```json
{
  "type": "all" | "sticky" | "rotating" | "sim"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sync completed: 5 proxies imported",
  "stats": {
    "imported": 5,
    "skipped": 0,
    "errors": 0
  },
  "proxies": [...]
}
```

### POST /api/proxies/rotate/{id}
Rotate a sticky proxy to get a new IP address.

**Response:**
```json
{
  "success": true,
  "message": "Proxy rotated successfully"
}
```

### POST /api/proxies/rotate-all
Rotate all sticky proxies and check their health.

**Response:**
```json
{
  "success": true,
  "rotated": 3,
  "healthy": 2,
  "unhealthy": 1
}
```

## Database Schema

The `proxies` table stores proxy information:

```sql
CREATE TABLE proxies (
  id UUID PRIMARY KEY,
  label TEXT,                    -- Human-readable name
  type TEXT,                     -- 'sticky', 'rotating', or 'sim'
  host TEXT,                     -- Proxy host
  port INTEGER,                  -- Proxy port
  username TEXT,                 -- Authentication username
  password TEXT,                 -- Authentication password
  session_id TEXT,               -- Session ID for sticky proxies
  soax_port INTEGER,             -- Original port for SIM proxies
  current_ip TEXT,               -- Current IP address
  health TEXT,                   -- Health status
  assigned_account_id UUID,      -- Assigned GeeLark account
  last_rotated TIMESTAMPTZ,      -- Last rotation time
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  meta JSONB                     -- Additional metadata
);
```

## Usage Examples

### 1. Import All Proxy Types
```javascript
// Click "Import Proxies" button on /proxies page
// This will import 5 sticky proxies, 1 rotating proxy, and 5 SIM proxies
```

### 2. Create Profile with Proxy
```javascript
// On /profiles/new page:
// 1. Fill in profile details
// 2. Check "Assign Proxy"
// 3. Select proxy type (Sticky or SIM)
// 4. Submit form
```

### 3. Rotate Proxy IP
```javascript
// On /proxies page:
// Click the refresh icon next to a sticky proxy
// The proxy will get a new session ID and IP address
```

## Troubleshooting

### Proxy Health Check Failed
- Ensure your server's IP is whitelisted in SOAX dashboard
- Check that proxy credentials are correct
- Verify network connectivity

### Cannot Import Proxies
- Verify all SOAX environment variables are set
- Check SOAX API key and package key are valid
- Ensure database migrations have been applied

### Proxy Assignment Failed
- Ensure GeeLark API is accessible
- Check that the proxy is not already assigned
- Verify the account exists in the database

## Best Practices

1. **IP Whitelisting**: Always whitelist your server's IP in SOAX dashboard
2. **Session Management**: Use unique session IDs for each sticky proxy
3. **Health Monitoring**: Regularly check proxy health status
4. **Rotation Strategy**: Rotate sticky proxies periodically to avoid detection
5. **Geographic Targeting**: Use country codes in proxy username for geo-targeting:
   ```
   package-{PACKAGE_KEY}-country-{CC}-sessionid-{SESSION_ID}
   ```

## Security Considerations

1. Keep SOAX credentials secure and never commit them to version control
2. Use environment variables for all sensitive configuration
3. Regularly rotate proxy sessions to maintain anonymity
4. Monitor proxy usage to detect any unusual activity
5. Implement rate limiting to prevent proxy abuse 