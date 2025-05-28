# GeeLark Network Request Configuration Guide

## Overview
This guide shows how to configure network requests in GeeLark to integrate with DaisySMS through your Spectre Studio app.

## Prerequisites
1. Your app must be deployed at https://spectre-studio.app
2. You need the account ID from your automation setup
3. The DaisySMS proxy endpoint must be accessible

## Task Flow Structure

### 1. Initial Setup
- **Parameter**: `accountId` (passed from your automation)

### 2. Get Phone Number
**Step Type**: Network Request
- **Request Type**: GET
- **Request URL**: 
  ```
  https://spectre-studio.app/api/geelark/daisysms-proxy?action=get_phone&account_id={{accountId}}
  ```
- **Save Response To**: `phoneData`

### 3. Extract Phone Number
**Step Type**: Set Variable
- **Variable Name**: `phoneNumber`
- **Value**: `{{phoneData.phone_number}}`

### 4. Enter Phone Number
**Step Type**: Input Text
- **Target**: Phone number field
- **Text**: `{{phoneNumber}}`

### 5. Click Continue
**Step Type**: Click
- **Target**: Continue button

### 6. Wait for OTP Screen
**Step Type**: Wait
- **Duration**: 5000ms

### 7. Start OTP Check Loop
**Step Type**: Loop (max 60 iterations, 5 second delay)

#### 7.1. Check OTP Status
**Step Type**: Network Request
- **Request Type**: GET
- **Request URL**: 
  ```
  https://spectre-studio.app/api/geelark/daisysms-proxy?action=check_otp&rental_id={{phoneData.rental_id}}
  ```
- **Save Response To**: `otpData`

#### 7.2. Check if OTP Received
**Step Type**: Condition
- **Condition**: `{{otpData.has_otp}} == true`
- **If True**: Continue to step 7.3
- **If False**: Continue loop

#### 7.3. Set OTP Variable
**Step Type**: Set Variable
- **Variable Name**: `otpCode`
- **Value**: `{{otpData.otp_code}}`

#### 7.4. Break Loop
**Step Type**: Break

### 8. Enter OTP
**Step Type**: Input Text
- **Target**: OTP input field
- **Text**: `{{otpCode}}`

### 9. Submit OTP
**Step Type**: Click
- **Target**: Next/Submit button

### 10. Handle Account Creation
**Step Type**: Click (optional)
- **Target**: Create Account button
- **Optional**: true

## Alternative: Single Request Method

If you want to get both phone and OTP in one request (useful for testing):

**Request URL**:
```
https://spectre-studio.app/api/geelark/daisysms-proxy?action=get_credentials&account_id={{accountId}}
```

**Response includes**:
```json
{
  "success": true,
  "phone_number": "2025551234",
  "otp_code": "123456",
  "rental_id": "237845899",
  "has_otp": true
}
```

## Testing Your Network Requests

You can test the endpoints directly:

```bash
# Test getting phone number
curl "https://spectre-studio.app/api/geelark/daisysms-proxy?action=get_phone&account_id=YOUR_ACCOUNT_ID"

# Test checking OTP
curl "https://spectre-studio.app/api/geelark/daisysms-proxy?action=check_otp&rental_id=YOUR_RENTAL_ID"
```

## Error Handling

The API returns consistent error responses:
```json
{
  "success": false,
  "error": "Error message here"
}
```

Always check `{{response.success}}` before using the data.

## Important Notes

1. **Security**: The proxy endpoint handles API authentication, so you don't need to expose DaisySMS credentials
2. **Phone Format**: The API automatically removes the US country code (1) from phone numbers
3. **OTP Timing**: OTP usually arrives within 30-60 seconds
4. **Loop Timeout**: Set your OTP check loop to timeout after 5 minutes (60 iterations × 5 seconds) 