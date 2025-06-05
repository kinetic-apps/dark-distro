# Tag System Documentation

## Overview

The Spectre platform uses a hybrid tag system that maintains tags both locally in Supabase and partially in GeeLark.

## How Tags Work

### 1. **Local Tags (Supabase)**
- Stored in the `phones.tags` column as a PostgreSQL array
- Fully editable at any time through the UI
- Used for filtering and bulk operations within Spectre
- No limitations on tag names or quantity

### 2. **GeeLark Tags**
- Can only be set during profile creation using the `tagsName` parameter
- Cannot be updated after profile creation (GeeLark limitation)
- GeeLark's update API only accepts `tagIDs` which reference pre-existing tags in their system
- We don't have access to GeeLark's tag management API

## Current Implementation

### Profile Creation
When creating new profiles, tags are sent to GeeLark:
```typescript
const profileParams = {
  tagsName: tags, // Array of tag names
  // ... other parameters
}
```

### Tag Updates
When updating tags through the UI:
1. Tags are updated locally in Supabase immediately
2. GeeLark tags remain unchanged (API limitation)
3. Remarks ARE synced to GeeLark successfully

### Database Schema
```sql
-- phones table
tags text[] -- Array of tag strings
remark text -- Synced with GeeLark
```

## Limitations

1. **GeeLark tags cannot be modified after profile creation**
   - The `/phone/detail/update` endpoint only accepts `tagIDs`, not `tagsName`
   - We don't have access to create tags and get their IDs

2. **Tags are primarily for local use**
   - Filtering in the Spectre UI works perfectly
   - Bulk operations based on tags work as expected
   - GeeLark console will only show tags set during creation

## Best Practices

1. **Plan tags before creating profiles** - Since GeeLark tags can't be changed, consider what tags you want in GeeLark before profile creation

2. **Use remarks for changeable metadata** - Remarks sync properly with GeeLark and can be updated anytime

3. **Rely on local tags for operations** - All Spectre features (filtering, bulk posts, etc.) use the local tag system which is fully functional

## API Endpoints

### Update Phone Metadata
`POST /api/phones/update-metadata`

```json
{
  "accountId": "uuid",
  "tags": ["tag1", "tag2"],  // Updates locally only
  "remark": "Some note"       // Syncs to GeeLark
}
```

### Create Profile
`POST /api/geelark/create-profile`

```json
{
  "tags": ["initial", "tags"],  // Set in GeeLark during creation
  "remark": "Initial remark",
  // ... other parameters
}
```

## Future Considerations

If GeeLark adds a tag management API in the future, we could:
1. Create tags dynamically and get their IDs
2. Use `tagIDs` to update phone tags
3. Maintain full sync between local and GeeLark tags

For now, the hybrid approach provides full functionality within Spectre while maintaining partial visibility in GeeLark. 