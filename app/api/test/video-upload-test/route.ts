import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const { video_url } = await request.json()

    if (!video_url) {
      return NextResponse.json(
        { error: 'Video URL is required' },
        { status: 400 }
      )
    }

    console.log('[Test] Starting video upload test with URL:', video_url)

    // Test 1: Validate URL
    try {
      const url = new URL(video_url)
      console.log('[Test] URL is valid:', url.hostname)
    } catch (error) {
      return NextResponse.json({
        error: 'Invalid URL format',
        details: String(error)
      }, { status: 400 })
    }

    // Test 2: Try to fetch video headers
    console.log('[Test] Fetching video headers...')
    try {
      const headResponse = await fetch(video_url, { 
        method: 'HEAD',
        signal: AbortSignal.timeout(10000) // 10 second timeout
      })
      
      const contentLength = headResponse.headers.get('content-length')
      const contentType = headResponse.headers.get('content-type')
      
      console.log('[Test] Video headers:', {
        status: headResponse.status,
        contentType,
        contentLength: contentLength ? `${(parseInt(contentLength) / 1024 / 1024).toFixed(2)} MB` : 'unknown'
      })

      if (!headResponse.ok) {
        return NextResponse.json({
          error: 'Cannot access video URL',
          status: headResponse.status,
          statusText: headResponse.statusText
        }, { status: 400 })
      }
    } catch (error) {
      console.error('[Test] Failed to fetch video headers:', error)
      return NextResponse.json({
        error: 'Failed to fetch video headers',
        details: error instanceof Error ? error.message : String(error)
      }, { status: 500 })
    }

    // Test 3: Get Geelark upload URL
    console.log('[Test] Getting Geelark upload URL...')
    try {
      const fileExtension = video_url.split('.').pop()?.toLowerCase() || 'mp4'
      const fileType = ['mp4', 'webm', 'mov'].includes(fileExtension) ? fileExtension : 'mp4'
      
      const { uploadUrl, resourceUrl } = await geelarkApi.getUploadUrl(fileType as any)
      
      console.log('[Test] Got Geelark URLs:', {
        uploadUrl: uploadUrl.substring(0, 50) + '...',
        resourceUrl
      })

      // Test 4: Try the actual upload
      console.log('[Test] Attempting video upload to Geelark...')
      const uploadedUrl = await geelarkApi.uploadVideoFromUrl(video_url)
      
      return NextResponse.json({
        success: true,
        message: 'Video upload test completed successfully',
        uploadedUrl,
        details: {
          originalUrl: video_url,
          geelarkUrl: uploadedUrl
        }
      })
    } catch (error) {
      console.error('[Test] Upload test failed:', error)
      return NextResponse.json({
        error: 'Upload test failed',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, { status: 500 })
    }
  } catch (error) {
    console.error('[Test] Video upload test error:', error)
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
} 