# TikTok SMS Setup Improvements

## Overview

This document describes the improvements made to the TikTok SMS setup flow to address two critical issues:

1. **TikTok UI Inconsistency**: TikTok shows different content on second launch, causing RPA failures
2. **DaisySMS Rental Timing**: Phone numbers were expiring while waiting for RPA to start

## Problems Identified

### Problem 1: TikTok UI Changes on Second Launch

**Issue**: The original flow was:
1. Install TikTok
2. Launch TikTok app (via `geelarkApi.startApp`)
3. Create RPA task
4. RPA opens TikTok again

This caused the RPA to encounter different UI elements because TikTok shows different content when opened for the second time (e.g., onboarding screens are skipped, different prompts appear).

**Solution**: Removed the manual TikTok launch step. Now the flow is:
1. Install TikTok
2. Create RPA task (RPA handles opening TikTok for the first time)

### Problem 2: DaisySMS Rental Expiring

**Issue**: The original flow was:
1. Rent DaisySMS number immediately
2. Create RPA task
3. Wait for RPA to start (30-50 seconds)
4. RPA uses the phone number

This caused rentals to expire or have less time available when the RPA actually needed them.

**Solution**: Reordered the flow:
1. Create RPA task first
2. Wait for task status to change to "In progress" (status 2)
3. Only then rent the DaisySMS number
4. Update account metadata with phone number

## Implementation Details

### Updated Flow

```typescript
// Step 1: Install TikTok (unchanged)
// Step 2: Create RPA task with account ID
const loginTask = await geelarkApi.createTikTokPhoneLoginTask(
  profileId,
  accountId,
  TIKTOK_FLOW_ID
)

// Step 3: Wait for RPA to actually start
while (!taskStarted && waitAttempts < maxWaitAttempts) {
  const taskStatus = await geelarkApi.getTaskStatus(loginTaskId)
  if (taskStatus.status === 'running' || taskStatus.result?.status === 2) {
    taskStarted = true
    break
  }
  await new Promise(resolve => setTimeout(resolve, 2000))
}

// Step 4: Now rent the phone number
const rental = await daisyApi.rentNumber(accountId, longTermRental)

// Step 5: Update account metadata with phone number
await supabaseAdmin.from('accounts').update({
  meta: {
    phone_number: phoneNumber,
    rental_id: rentalId,
    // ... other metadata
  }
}).eq('id', accountId)
```

### RPA Task Flow Updates

The RPA task flow needs to be updated to:

1. **Fetch phone number from account metadata** instead of receiving it as a parameter
2. **Handle the first-time TikTok launch** including any onboarding screens

Example RPA flow pseudocode:
```javascript
// In the RPA task flow
async function getTikTokPhoneLoginFlow(accountId) {
  // Fetch account data
  const account = await fetch(`/api/accounts/${accountId}`)
  const phoneNumber = account.meta.phone_number_formatted
  
  // Launch TikTok for the first time
  await launchApp('com.zhiliaoapp.musically')
  
  // Handle any first-time popups/permissions
  await handleFirstLaunchScreens()
  
  // Navigate to login
  await click('Profile')
  await click('Use phone or email')
  
  // Enter phone number
  await enterText(phoneNumber)
  // ... continue with login flow
}
```

## Benefits

1. **Higher Success Rate**: RPA encounters consistent UI by being the first to open TikTok
2. **Better Resource Utilization**: DaisySMS rentals are only created when actually needed
3. **Cost Savings**: Reduced wasted rentals from expired phone numbers
4. **Improved Debugging**: Clear separation between task creation and phone rental

## Migration Notes

- Existing RPA task flows need to be updated to fetch phone numbers from account metadata
- The `loginTikTokWithPhone` method is deprecated in favor of `createTikTokPhoneLoginTask`
- Monitor logs for "RPA task has started!" to ensure proper timing

## Future Improvements

1. **Dynamic Task Flow Selection**: Automatically detect and use the correct task flow ID
2. **Retry Logic**: Add automatic retry if RPA task fails to start within timeout
3. **Phone Number Pool**: Pre-rent numbers and assign from pool for faster setup
4. **Task Status Webhooks**: Use webhooks instead of polling for task status changes 