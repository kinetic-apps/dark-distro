# Proxy Selection Guide

This guide explains the enhanced proxy selection system in Spectre, which supports multiple proxy sources and automatic assignment.

## Overview

The proxy selection system allows you to configure proxies from multiple sources:
- **Auto**: Automatically selects the best available proxy from your database
- **Database**: Manually select from proxies stored in your local database
- **GeeLark**: Select from proxies already configured in GeeLark
- **Manual**: Enter proxy details manually

## Proxy Sources

### 1. Auto Mode (Recommended)

Auto mode intelligently selects an available proxy based on priority:
1. **SIM Proxies** (Mobile) - Best for TikTok
2. **Sticky Proxies** - Good for consistent IP
3. **Rotating Proxies** - For general use

```javascript
// Auto mode configuration
{
  assign_proxy: true,
  proxy_type: 'sim'  // Optional: specify preference
}
```

### 2. Database Proxies

Select from proxies stored in your Supabase database:
- Shows only unassigned proxies by default
- Displays proxy health status
- Shows proxy type (sim, sticky, rotating)

```javascript
// Database proxy configuration
{
  database_proxy_id: 'uuid-of-proxy',
  // Proxy details are fetched automatically
}
```

### 3. GeeLark Proxies

Select from proxies already configured in GeeLark:
- Requires proxies to be added to GeeLark first
- Uses GeeLark's proxy management
- Proxy details remain in GeeLark

```javascript
// GeeLark proxy configuration
{
  proxy_id: 'geelark-proxy-id'
}
```

### 4. Manual Configuration

Enter proxy details directly:
- Supports SOCKS5, HTTP, and HTTPS
- Optional authentication
- Good for testing or one-off proxies

```javascript
// Manual proxy configuration
{
  proxy_config: {
    typeId: 1,  // 1: SOCKS5, 2: HTTP, 3: HTTPS
    server: 'proxy.example.com',
    port: 1080,
    username: 'user',  // Optional
    password: 'pass'   // Optional
  }
}
```

## Database Schema

### Proxies Table

```sql
CREATE TABLE proxies (
  id UUID PRIMARY KEY,
  label TEXT,
  type TEXT CHECK (type IN ('sticky', 'rotating', 'sim')),
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT,
  password TEXT,
  session_id TEXT,
  current_ip INET,
  last_rotated TIMESTAMPTZ,
  health TEXT CHECK (health IN ('good', 'slow', 'blocked', 'unknown')),
  assigned_account_id UUID REFERENCES accounts(id),
  geelark_proxy_id TEXT,
  soax_port INTEGER,
  meta JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## API Integration

### TikTok SMS Setup

The enhanced proxy selection is integrated into the TikTok SMS setup flow:

```typescript
// Frontend component usage
<ProxySelector
  value={selectedProxyId}
  onChange={(value, proxyData) => {
    setSelectedProxyId(value)
    setSelectedProxyData(proxyData)
  }}
  source={proxySource}
  onSourceChange={(source) => setProxySource(source)}
  showSourceSelector={true}
  filterAssigned={true}
/>
```

### Create Profile API

The create-profile endpoint handles all proxy configurations:

```typescript
POST /api/geelark/create-profile
{
  // Option 1: Auto-assign
  "assign_proxy": true,
  "proxy_type": "sim",
  
  // Option 2: Database proxy
  "database_proxy_id": "uuid",
  
  // Option 3: GeeLark proxy
  "proxy_id": "geelark-id",
  
  // Option 4: Manual proxy
  "proxy_config": {
    "typeId": 1,
    "server": "proxy.host",
    "port": 1080
  }
}
```

## Proxy Management

### Adding Proxies to Database

```sql
INSERT INTO proxies (label, type, host, port, username, password)
VALUES 
  ('SIM-US-1', 'sim', 'us.proxy.com', 8080, 'user', 'pass'),
  ('Sticky-Pool-1', 'sticky', 'sticky.proxy.com', 9090, 'user', 'pass');
```

### Syncing with GeeLark

Use the sync endpoints to keep proxies synchronized:

```bash
# Sync database proxies to GeeLark
POST /api/geelark/sync-proxies

# Sync GeeLark profiles (imports proxies)
POST /api/geelark/sync-profiles
```

### Proxy Assignment

Proxies are automatically assigned to accounts:
- Assignment happens during profile creation
- Tracks which account uses which proxy
- Prevents double assignment

## Best Practices

### 1. Proxy Types for TikTok

- **SIM/Mobile Proxies**: Best for TikTok accounts
  - Most authentic mobile IPs
  - Lower ban risk
  - Higher cost

- **Sticky Proxies**: Good for consistency
  - Same IP for extended periods
  - Good for warmup phase
  - Medium cost

- **Rotating Proxies**: General use
  - IP changes periodically
  - Not ideal for TikTok
  - Lower cost

### 2. Proxy Health Monitoring

Monitor proxy health regularly:
```sql
-- Check proxy health
SELECT label, type, health, assigned_account_id
FROM proxies
WHERE health IN ('slow', 'blocked')
ORDER BY updated_at DESC;
```

### 3. Proxy Rotation

For SIM proxies, rotate IPs when needed:
```bash
POST /api/proxies/rotate/{id}
POST /api/proxies/rotate-all
```

### 4. Capacity Planning

- Keep 20-30% spare proxies
- Monitor assignment rates
- Plan for growth

## Troubleshooting

### "No available proxies found"

1. Check proxy inventory:
```sql
SELECT type, COUNT(*) as total,
       COUNT(*) FILTER (WHERE assigned_account_id IS NULL) as available
FROM proxies
GROUP BY type;
```

2. Add more proxies or use different type
3. Check if proxies are healthy

### "Proxy verification failed"

1. Test proxy connectivity
2. Check credentials
3. Verify proxy is not blocked
4. Try manual configuration first

### GeeLark Proxy Issues

1. Ensure proxy exists in GeeLark
2. Check GeeLark API credentials
3. Verify proxy ID is correct
4. Use list-proxies endpoint to debug

## Security Considerations

1. **Credentials**: Store proxy passwords securely
2. **Rotation**: Rotate credentials periodically
3. **Monitoring**: Track failed connections
4. **Isolation**: One proxy per account
5. **Backup**: Keep backup proxies ready

## Future Enhancements

1. **Auto-healing**: Automatic proxy replacement on failure
2. **Performance Metrics**: Track proxy speed and reliability
3. **Cost Tracking**: Monitor proxy costs per account
4. **Geographic Selection**: Choose proxies by location
5. **Provider Integration**: Direct integration with proxy providers 