import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const { profileId, params } = await request.json()

    if (!profileId) {
      return NextResponse.json(
        { error: 'Profile ID is required' },
        { status: 400 }
      )
    }

    console.log('[Test] Starting profile edit test for:', profileId)
    console.log('[Test] Parameters:', params)

    // Handle avatar upload if provided
    let geelarkAvatarUrl: string | undefined
    if (params?.avatar) {
      try {
        // Determine file type from URL
        const fileExtension = params.avatar.split('.').pop()?.toLowerCase()
        const supportedTypes = ['png', 'jpg', 'jpeg', 'webp']
        const fileType = supportedTypes.includes(fileExtension) ? fileExtension : 'jpg'
        
        console.log('[Test] Uploading avatar to Geelark:', params.avatar)
        geelarkAvatarUrl = await geelarkApi.uploadFileFromUrl(params.avatar, fileType as any)
        console.log('[Test] Avatar uploaded to Geelark:', geelarkAvatarUrl)
      } catch (error) {
        console.error('[Test] Failed to upload avatar to Geelark:', error)
        return NextResponse.json(
          { 
            error: 'Avatar upload failed',
            details: error instanceof Error ? error.message : 'Unknown error'
          },
          { status: 500 }
        )
      }
    }

    // Create edit parameters
    const editParams = {
      nickName: params?.nickName || 'Test Profile',
      bio: params?.bio || 'This is a test bio',
      site: params?.site || 'https://example.com',
      avatar: geelarkAvatarUrl
    }

    console.log('[Test] Edit parameters:', editParams)

    // Create the profile edit task
    const response = await geelarkApi.editTikTokProfile(profileId, editParams)

    console.log('[Test] Profile edit response:', response)

    return NextResponse.json({
      success: true,
      taskId: response.taskId,
      editParams,
      avatarUpload: {
        original: params?.avatar,
        geelark: geelarkAvatarUrl
      },
      message: 'Profile edit task created successfully'
    })

  } catch (error) {
    console.error('[Test] Profile edit test error:', error)
    return NextResponse.json(
      { 
        error: 'Profile edit test failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
} 