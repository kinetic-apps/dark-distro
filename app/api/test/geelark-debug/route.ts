import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function GET(request: NextRequest) {
  try {
    // Test 1: Check environment variables
    const config = {
      API_BASE_URL: process.env.GEELARK_API_BASE_URL || 'NOT SET',
      API_KEY: process.env.GEELARK_API_KEY ? '***' + process.env.GEELARK_API_KEY.slice(-4) : 'NOT SET',
      APP_ID: process.env.GEELARK_APP_ID || 'NOT SET'
    }

    // Test 2: Try to list profiles
    let profiles = null
    let profileError = null
    try {
      profiles = await geelarkApi.getProfileList()
    } catch (e) {
      profileError = e instanceof Error ? e.message : String(e)
    }

    // Test 3: Try to create a minimal profile
    let createTest = null
    let createError = null
    try {
      createTest = await geelarkApi.createProfile({
        androidVersion: 3,
        groupName: 'api-test',
        remark: 'API connection test'
      })
    } catch (e) {
      createError = e instanceof Error ? e.message : String(e)
    }

    return NextResponse.json({
      success: true,
      config,
      tests: {
        listProfiles: {
          success: !!profiles,
          error: profileError,
          profileCount: profiles?.length || 0
        },
        createProfile: {
          success: !!createTest,
          error: createError,
          result: createTest
        }
      }
    })
  } catch (error) {
    console.error('GeeLark test error:', error)
    return NextResponse.json(
      { 
        error: 'GeeLark test failed',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 