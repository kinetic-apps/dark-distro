import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { adbControl } from '@/lib/services/adb-control-service'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { profile_id, phone_number, otp_code } = body

    if (!profile_id) {
      return NextResponse.json({ error: 'profile_id is required' }, { status: 400 })
    }

    const steps: any[] = []

    // Step 1: Enable ADB
    try {
      await geelarkApi.enableADB([profile_id])
      steps.push({ step: 'Enable ADB', status: 'success' })
      
      // Wait for ADB to be ready
      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error) {
      steps.push({ 
        step: 'Enable ADB', 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }

    // Step 2: Get ADB info
    let adbDevice: any
    try {
      const adbInfo = await geelarkApi.getADBInfo([profile_id])
      
      if (!adbInfo.items || adbInfo.items.length === 0 || adbInfo.items[0].code !== 0) {
        const errorCode = adbInfo.items?.[0]?.code
        const errorMsg = errorCode === 42001 ? 'Cloud phone does not exist' :
                        errorCode === 42002 ? 'Cloud phone is not running' :
                        errorCode === 49001 ? 'ADB is not enabled' :
                        errorCode === 49002 ? 'Device does not support ADB' : 'Unknown error'
        throw new Error(`Failed to get ADB info: ${errorMsg}`)
      }
      
      adbDevice = adbInfo.items[0]
      steps.push({ 
        step: 'Get ADB Info', 
        status: 'success',
        data: { ip: adbDevice.ip, port: adbDevice.port }
      })
    } catch (error) {
      steps.push({ 
        step: 'Get ADB Info', 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }

    // Step 3: Connect to ADB
    try {
      const connected = await adbControl.connect({
        ip: adbDevice.ip,
        port: adbDevice.port,
        password: adbDevice.pwd,
        deviceId: profile_id
      })
      
      if (!connected) {
        throw new Error('Failed to connect to device via ADB')
      }
      
      steps.push({ step: 'Connect ADB', status: 'success' })
    } catch (error) {
      steps.push({ 
        step: 'Connect ADB', 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      })
      throw error
    }

    // Step 4: Launch TikTok
    try {
      await adbControl.launchTikTok()
      await new Promise(resolve => setTimeout(resolve, 5000))
      steps.push({ step: 'Launch TikTok', status: 'success' })
    } catch (error) {
      steps.push({ 
        step: 'Launch TikTok', 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      })
    }

    // Step 5: Navigate to login (if phone_number provided)
    if (phone_number) {
      try {
        const navigated = await adbControl.navigateToTikTokLogin()
        if (!navigated) {
          await adbControl.takeScreenshot(`test_nav_failed_${Date.now()}.png`)
          throw new Error('Failed to navigate to login screen')
        }
        steps.push({ step: 'Navigate to Login', status: 'success' })
        
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Enter phone number
        const phoneEntered = await adbControl.enterPhoneNumber(phone_number)
        if (!phoneEntered) {
          await adbControl.takeScreenshot(`test_phone_failed_${Date.now()}.png`)
          throw new Error('Failed to enter phone number')
        }
        steps.push({ step: 'Enter Phone Number', status: 'success' })
        
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Click Continue
        const continueClicked = await adbControl.clickContinueButton()
        steps.push({ 
          step: 'Click Continue', 
          status: continueClicked ? 'success' : 'warning',
          message: continueClicked ? 'Clicked Continue' : 'Continue button not found'
        })
      } catch (error) {
        steps.push({ 
          step: 'Phone Login', 
          status: 'failed', 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }

    // Step 6: Enter OTP (if provided)
    if (otp_code) {
      try {
        const otpEntered = await adbControl.enterOTP(otp_code)
        if (!otpEntered) {
          await adbControl.takeScreenshot(`test_otp_failed_${Date.now()}.png`)
          throw new Error('Failed to enter OTP')
        }
        steps.push({ step: 'Enter OTP', status: 'success' })
        
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Try to confirm account creation
        const accountCreated = await adbControl.confirmAccountCreation()
        steps.push({ 
          step: 'Confirm Account', 
          status: accountCreated ? 'success' : 'warning',
          message: accountCreated ? 'Account created' : 'Create account button not found'
        })
      } catch (error) {
        steps.push({ 
          step: 'OTP Entry', 
          status: 'failed', 
          error: error instanceof Error ? error.message : String(error) 
        })
      }
    }

    // Step 7: Take screenshot
    try {
      const screenshotName = `test_final_${Date.now()}.png`
      await adbControl.takeScreenshot(screenshotName)
      steps.push({ 
        step: 'Screenshot', 
        status: 'success',
        filename: screenshotName
      })
    } catch (error) {
      steps.push({ 
        step: 'Screenshot', 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      })
    }

    // Disconnect ADB
    try {
      await adbControl.disconnect()
      steps.push({ step: 'Disconnect ADB', status: 'success' })
    } catch (error) {
      steps.push({ 
        step: 'Disconnect ADB', 
        status: 'failed', 
        error: error instanceof Error ? error.message : String(error) 
      })
    }

    // Log the test
    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'test-adb-tiktok',
      message: 'ADB TikTok login test completed',
      meta: { 
        profile_id,
        phone_number,
        has_otp: !!otp_code,
        steps
      }
    })

    return NextResponse.json({
      success: true,
      steps,
      adb_info: {
        ip: adbDevice.ip,
        port: adbDevice.port
      }
    })

  } catch (error) {
    console.error('ADB TikTok test error:', error)
    
    // Try to disconnect on error
    try {
      await adbControl.disconnect()
    } catch (disconnectError) {
      console.error('Failed to disconnect ADB:', disconnectError)
    }
    
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Test failed',
        details: error
      },
      { status: 500 }
    )
  }
} 