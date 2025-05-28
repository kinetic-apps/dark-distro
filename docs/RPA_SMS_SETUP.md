# RPA-Based TikTok SMS Setup

## Overview

The RPA-based TikTok SMS setup feature enables fully automated TikTok account creation using phone numbers and SMS verification through DaisySMS. This implementation uses GeeLark's RPA (Robotic Process Automation) task flows to control the device UI, automating the entire login flow without requiring any local tools or dependencies.

## Key Features

- **Fully Automated Phone Login**: Uses GeeLark RPA to navigate TikTok's UI and enter phone numbers
- **Automatic OTP Entry**: Monitors DaisySMS for OTP codes and creates a second RPA task to enter them
- **No Manual Intervention**: Complete hands-off account creation process
- **Integrated Warmup**: Automatically starts warmup after successful login
- **Vercel Compatible**: Works on serverless platforms without requiring ADB tools

## Requirements

### GeeLark Requirements
- GeeLark account with RPA task flow support
- Custom task flow created for TikTok phone login
- Cloud phones running any Android version

### System Requirements
- Node.js environment (works on Vercel)
- Network access to GeeLark API
- DaisySMS account with balance

## Setup Instructions

### Step 1: Create RPA Task Flow in GeeLark

1. Log into your GeeLark dashboard
2. Navigate to RPA Task Flows section
3. Create a new task flow named "TikTok Phone Login"
4. Add the following steps:
   - Click "Profile" button (content-desc="Profile")
   - Click "Use phone or email" button
   - Enter phone number (parameter: `phoneNumber`)
   - Click "Continue" button
   - Wait for OTP field
   - Enter OTP code (parameter: `otpCode`)
   - Click "Next" or submit
   - Click "Create account" if prompted
5. Save the task flow and note the Flow ID

### Step 2: Configure Your Application

Add the task flow ID to your environment variables:
```env
GEELARK_TIKTOK_FLOW_ID=your_flow_id_here
```

Or let the system auto-detect it by naming your flow with "tiktok" and "phone" keywords.

## How It Works

### 1. Profile Creation/Selection
- Creates a new GeeLark profile or uses an existing one
- Configures device settings (model, Android version)
- Assigns proxy configuration

### 2. Phone Startup
- Starts the GeeLark cloud phone
- Waits for device to be fully running
- Ensures stable connection

### 3. TikTok Installation
- Checks if TikTok is installed
- Installs TikTok if needed
- Waits for installation to complete

### 4. DaisySMS Integration
- Rents a US phone number from DaisySMS
- Supports both short-term and long-term rentals
- Stores rental information for tracking

### 5. RPA Phone Login
- Launches TikTok app
- Creates RPA task with phone number
- Task navigates to login and enters phone
- Monitors task status

### 6. OTP Monitoring
- Monitors DaisySMS API for incoming OTP
- When OTP received, creates second RPA task
- Second task enters the OTP code
- Monitors for successful account creation

### 7. Post-Login Actions
- Updates account status to active
- Starts warmup if configured
- Completes DaisySMS rental

## API Endpoints

### Main Setup Endpoint
```
POST /api/automation/setup-tiktok-with-sms
```

Request body:
```json
{
  "use_existing_profile": false,
  "device_model": "Pixel 6",
  "android_version": 3,
  "proxy_id": "optional-geelark-proxy-id",
  "assign_proxy": true,
  "proxy_type": "sim",
  "group_name": "tiktok-sms-setup",
  "task_flow_id": "optional-flow-id",
  "long_term_rental": false,
  "warmup_duration_minutes": 30,
  "warmup_action": "browse video"
}
```

### Query Task Flows
```
GET /api/geelark/task-flows
```

Returns available task flows, including TikTok-related ones.

## GeeLark API Methods

### Task Flow Management
- `getTaskFlows()`: List all available RPA task flows
- `createCustomRPATask()`: Create a custom RPA task
- `loginTikTokWithPhone()`: Initiate phone login RPA
- `updateRPATaskWithOTP()`: Create OTP entry task

## Error Handling

### RPA Task Errors
- Task not found: Verify flow ID exists
- Task failed: Check GeeLark logs for details
- Parameters missing: Ensure phoneNumber and otpCode params

### Flow Detection
- No flows found: Create flow in GeeLark dashboard
- Multiple flows: System picks first matching flow
- Auto-detection: Names must contain "tiktok" or "phone"

## Database Schema

Account metadata stores RPA task info:
```json
{
  "phone_number": "11234567890",
  "phone_number_formatted": "1234567890",
  "rental_id": "daisysms-rental-id",
  "setup_type": "daisysms",
  "login_method": "phone_rpa",
  "login_task_id": "geelark-task-id",
  "task_flow_id": "flow-id"
}
```

## Monitoring and Logs

All operations are logged with component identifiers:
- `automation-tiktok-sms`: Main setup process
- `automation-tiktok-sms-monitor`: OTP monitoring
- `geelark-api`: GeeLark API calls

## Best Practices

1. **Task Flow Design**: Keep flows simple and reliable
2. **Error Recovery**: Add wait steps between actions
3. **Proxy Configuration**: Always use proxies for TikTok
4. **Warmup Duration**: 30-60 minutes for new accounts
5. **Long-term Rentals**: Enable for accounts that may need re-login

## Troubleshooting

### Task Flow Not Found
- Verify flow exists in GeeLark dashboard
- Check flow has required parameters
- Ensure flow ID is correct

### Phone Number Not Entered
- Check task flow includes phone input step
- Verify TikTok UI hasn't changed
- Review task execution logs

### OTP Not Entered
- Ensure second task is created after OTP received
- Check task flow handles OTP input
- Verify OTP code format

### Login Failed
- Review GeeLark task logs
- Check if TikTok requires captcha
- Verify proxy is working correctly

## Advantages Over ADB

1. **No Local Dependencies**: Works on any platform
2. **Serverless Compatible**: Perfect for Vercel deployment
3. **Easier Maintenance**: Update flows without code changes
4. **Better Reliability**: GeeLark handles device quirks
5. **Visual Debugging**: See task execution in dashboard 