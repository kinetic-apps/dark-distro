import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const { profileIds, params, waitForCompletion = false } = await request.json()

    if (!profileIds || !Array.isArray(profileIds) || profileIds.length === 0) {
      return NextResponse.json(
        { error: 'No profiles selected' },
        { status: 400 }
      )
    }

    if (!params || Object.keys(params).length === 0) {
      return NextResponse.json(
        { error: 'No edit parameters provided' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get accounts with GeeLark profile IDs
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('id, geelark_profile_id, tiktok_username')
      .in('id', profileIds)
      .not('geelark_profile_id', 'is', null)

    if (accountsError) {
      console.error('Error fetching accounts:', accountsError)
      return NextResponse.json(
        { error: 'Failed to fetch accounts' },
        { status: 500 }
      )
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json(
        { error: 'No valid profiles found with GeeLark IDs' },
        { status: 400 }
      )
    }

    // If avatar is provided, upload it to Geelark first
    let geelarkAvatarUrl: string | undefined
    if (params.avatar) {
      try {
        // Determine file type from URL
        const fileExtension = params.avatar.split('.').pop()?.toLowerCase()
        const supportedTypes = ['png', 'jpg', 'jpeg', 'webp']
        const fileType = supportedTypes.includes(fileExtension) ? fileExtension : 'jpg'
        
        console.log('Uploading avatar to Geelark:', params.avatar)
        geelarkAvatarUrl = await geelarkApi.uploadFileFromUrl(params.avatar, fileType as any)
        console.log('Avatar uploaded to Geelark:', geelarkAvatarUrl)
      } catch (error) {
        console.error('Failed to upload avatar to Geelark:', error)
        // Continue without avatar if upload fails
      }
    }

    // Schedule profile edit tasks
    const results = []

    for (const account of accounts) {
      try {
        // Create the profile edit task using the geelarkApi
        const response = await geelarkApi.editTikTokProfile(account.geelark_profile_id, {
          avatar: geelarkAvatarUrl,
          nickName: params.nickName,
          bio: params.bio,
          site: params.site
        })

        if (response?.taskId) {
          // Store task in database
          const { error: taskError } = await supabase
            .from('tasks')
            .insert({
              account_id: account.id,
              type: 'profile_edit',
              status: 'pending',
              geelark_task_id: response.taskId,
              meta: {
                edit_params: {
                  ...params,
                  avatar: geelarkAvatarUrl || params.avatar
                },
                wait_for_completion: waitForCompletion
              }
            })

          if (taskError) {
            console.error('Error storing task:', taskError)
          }

          // If waitForCompletion is true, wait for the task to complete
          if (waitForCompletion) {
            try {
              await geelarkApi.waitForTaskCompletion(response.taskId, account.geelark_profile_id)
              results.push({
                profile_id: account.id,
                username: account.tiktok_username,
                status: 'completed',
                task_id: response.taskId
              })
            } catch (error) {
              results.push({
                profile_id: account.id,
                username: account.tiktok_username,
                status: 'failed',
                task_id: response.taskId,
                error: error instanceof Error ? error.message : 'Task execution failed'
              })
            }
          } else {
            results.push({
              profile_id: account.id,
              username: account.tiktok_username,
              status: 'success',
              task_id: response.taskId
            })
          }
        } else {
          results.push({
            profile_id: account.id,
            username: account.tiktok_username,
            status: 'failed',
            error: 'Failed to create edit task'
          })
        }
      } catch (error) {
        console.error(`Error creating edit task for ${account.id}:`, error)
        results.push({
          profile_id: account.id,
          username: account.tiktok_username,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Calculate summary
    const summary = {
      total_profiles: accounts.length,
      successful_tasks: results.filter(r => r.status === 'success' || r.status === 'completed').length,
      failed_tasks: results.filter(r => r.status === 'failed').length,
      completed_tasks: results.filter(r => r.status === 'completed').length
    }

    return NextResponse.json({
      success: true,
      summary,
      results,
      waited_for_completion: waitForCompletion
    })

  } catch (error) {
    console.error('Bulk profile edit error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 