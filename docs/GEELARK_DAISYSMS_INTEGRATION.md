# Geelark DaisySMS Integration Guide

## Overview
This guide explains how to properly configure Geelark task flows to integrate with the DaisySMS proxy API for TikTok phone number login automation.

## Task Flow Parameters

When creating the RPA task for TikTok phone login, the following parameters are passed to Geelark:

- `${accountId}` - The UUID of the account being created
- `${username}` - The generated TikTok username (format: `spectre_XXXXXX`)
- `${password}` - The shared password for all automated accounts

These parameters should be used in your Geelark task flow as follows:
1. Use `${accountId}` in network requests to fetch phone/OTP data
2. Use `${username}` when filling the username field during account creation
3. Use `${password}` when filling the password field during account creation

## API Endpoints

### Base URL
```
https://spectre-studio.app/api/geelark/daisysms-proxy
```

### Available Actions

#### 1. Get Phone and Check OTP (`get_phone_and_check_otp`) - RECOMMENDED FOR GEELARK
**This is the simplest option for Geelark integration** - it combines phone retrieval and OTP checking in a single request.

**Request:**
```
GET /api/geelark/daisysms-proxy?action=get_phone_and_check_otp&account_id={{accountId}}
```

**Parameters:**
- `action`: Must be `get_phone_and_check_otp`
- `account_id`: The account ID (UUID) - this should be passed as a variable from Geelark

**Response:**
```json
{
  "success": true,
  "phone_number": "2253151957",  // Without country code
  "rental_id": "238877403",       // DaisySMS rental ID
  "status": "waiting",            // Rental status
  "otp_code": "",                 // Empty if no OTP yet
  "has_otp": false                // Boolean indicating if OTP is available
}
```

#### 2. Get Phone Number (`get_phone`)
Retrieves the phone number and rental ID for a specific account.

**Request:**
```
GET /api/geelark/daisysms-proxy?action=get_phone&account_id={{accountId}}
```

**Parameters:**
- `action`: Must be `get_phone`
- `account_id`: The account ID (UUID) to fetch phone data for

**Response:**
```json
{
  "success": true,
  "phone_number": "2253151957",  // Without country code
  "rental_id": "238877403",       // DaisySMS rental ID
  "status": "waiting"             // Rental status
}
```

#### 3. Check OTP (`check_otp`)
Checks if an OTP has been received for a specific rental.

**Request:**
```
GET /api/geelark/daisysms-proxy?action=check_otp&rental_id={{rentalId}}
```

**Parameters:**
- `action`: Must be `check_otp`
- `rental_id`: The DaisySMS rental ID (not the account ID)

**Response:**
```json
{
  "success": true,
  "status": "received",    // waiting, received, cancelled, expired
  "otp_code": "123456",    // Empty string if no OTP yet
  "has_otp": true          // Boolean indicating if OTP is available
}
```

#### 4. Get Credentials (`get_credentials`)
**Note:** This action requires phone data to be stored in account metadata. Currently not working with the standard setup flow.

## Correct Task Flow Configuration

### Simplified Approach (Recommended for Geelark)

Since Geelark has limitations with dynamic URL parameters, use the combined endpoint:

1. **Single Network Request Configuration:**
   - **URL:** `https://spectre-studio.app/api/geelark/daisysms-proxy?action=get_phone_and_check_otp&account_id={{accountId}}`
   - **Method:** GET
   - **Assign Response to:** `phoneData` (or any variable name)

2. **Use the Response Data:**
   - Phone number: `phoneData.phone_number` (use this to fill the phone field)
   - OTP code: `phoneData.otp_code` (use this to fill the OTP field)
   - Has OTP: `phoneData.has_otp` (check if true before trying to use OTP)

3. **For OTP Monitoring:**
   - Make the same request periodically until `has_otp` becomes `true`
   - The `otp_code` field will contain the verification code when available

### Advanced Two-Step Approach (If Geelark Supports Dynamic URLs)

### Step 1: Fetch Phone Number
Configure your first HTTP request in the Geelark task flow:

```
URL: https://spectre-studio.app/api/geelark/daisysms-proxy?action=get_phone&account_id={{accountId}}
Method: GET
```

This will return the phone number and rental ID that you'll need for subsequent steps.

### Step 2: Use Phone Number for Login
Use the `phone_number` from Step 1 to fill in the TikTok phone number field.

### Step 3: Check for OTP
After triggering the SMS send, periodically check for the OTP:

```
URL: https://spectre-studio.app/api/geelark/daisysms-proxy?action=check_otp&rental_id={{rentalId}}
Method: GET
```

Where `{{rentalId}}` should be replaced with the actual rental ID from Step 1.

## Common Issues

### Issue: "BAD_ID" Error
**Cause:** The rental ID is not being properly passed or is still a template variable like `{{rentalId}}`.

**Solution:** Ensure the rental ID from Step 1 is properly stored and used in Step 3.

### Issue: "No phone number found"
**Cause:** The account doesn't have an associated SMS rental.

**Solution:** Ensure the SMS rental was created successfully before attempting to fetch phone data.

## Example Workflow Test

You can test the complete workflow using:

```bash
# Test with an account ID
curl "http://localhost:3000/api/test/daisysms-workflow?account_id=YOUR_ACCOUNT_ID"
```

This will show you the exact URLs and responses for both steps of the workflow.

## Task Flow Variables

When configuring the Geelark task flow, you'll need these variables:

1. **Input Parameter:** `accountId` - Passed when creating the RPA task
2. **Extracted from Step 1:** 
   - `phoneNumber` - The formatted phone number
   - `rentalId` - The DaisySMS rental ID
3. **Extracted from Step 3:** 
   - `otpCode` - The verification code

## Important Notes

1. Phone numbers are returned without the country code (e.g., "2253151957" instead of "12253151957")
2. The rental status can be: `waiting`, `received`, `cancelled`, or `expired`
3. OTP codes are typically 6 digits
4. The API automatically logs all requests for debugging purposes 