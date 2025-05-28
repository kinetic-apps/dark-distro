import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    console.log('Starting simple profile test...')
    
    // Use the existing GeeLark proxy we found
    const result = await geelarkApi.createProfile({
      androidVersion: 3,
      groupName: 'simple-test',
      remark: 'Simple test profile',
      proxyId: '568281218731212990'  // The GeeLark proxy ID we found
    })
    
    console.log('Profile created successfully:', result)
    
    return NextResponse.json({
      success: true,
      result: result
    })
  } catch (error) {
    console.error('Simple profile test error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to create profile',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
} 