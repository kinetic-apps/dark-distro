import { NextRequest, NextResponse } from 'next/server'
import { geelarkApi } from '@/lib/geelark-api'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    // Get all pending tasks
    const { data: pendingPosts, error } = await supabaseAdmin
      .from('posts')
      .select('*')
      .in('status', ['pending', 'processing'])
      .not('task_id', 'is', null)

    if (error) {
      console.error('Error fetching pending posts:', error)
      return NextResponse.json({ error: 'Failed to fetch pending posts' }, { status: 500 })
    }

    if (!pendingPosts || pendingPosts.length === 0) {
      return NextResponse.json({ message: 'No pending tasks to update' })
    }

    const taskIds = pendingPosts.map(post => post.task_id).filter(Boolean)
    
    // Query task statuses from Geelark
    const taskStatuses = await geelarkApi.queryTasks(taskIds)
    
    // Map Geelark status codes to our statuses
    const statusMap: Record<number, string> = {
      1: 'pending',    // Waiting
      2: 'processing', // In progress
      3: 'posted',     // Completed
      4: 'failed',     // Failed
      7: 'failed'      // Cancelled
    }

    // Update each post based on task status
    const updates = []
    for (const post of pendingPosts) {
      const taskStatus = taskStatuses.items?.find((task: any) => task.id === post.task_id)
      
      if (taskStatus) {
        const newStatus = statusMap[taskStatus.status] || post.status
        
        if (newStatus !== post.status) {
          updates.push({
            id: post.id,
            status: newStatus,
            updated_at: new Date().toISOString(),
            ...(newStatus === 'posted' && {
              posted_at: new Date().toISOString()
            }),
            ...(taskStatus.failCode && {
              error_message: `${taskStatus.failDesc || 'Task failed'} (Code: ${taskStatus.failCode})`
            })
          })

          // Also update the tasks table if the post is completed or failed
          if (newStatus === 'posted' || newStatus === 'failed') {
            await supabaseAdmin
              .from('tasks')
              .update({
                status: newStatus === 'posted' ? 'completed' : 'failed',
                completed_at: new Date().toISOString(),
                error_message: taskStatus.failDesc || null,
                meta: {
                  geelark_status: taskStatus.status,
                  fail_code: taskStatus.failCode,
                  fail_desc: taskStatus.failDesc
                }
              })
              .eq('geelark_task_id', post.task_id)
          }

          // Log the status change
          await supabaseAdmin.from('logs').insert({
            level: 'info',
            component: 'task-status-update',
            account_id: post.account_id,
            message: `Task status updated: ${post.status} -> ${newStatus}`,
            meta: { 
              post_id: post.id,
              task_id: post.task_id,
              old_status: post.status,
              new_status: newStatus,
              geelark_status: taskStatus.status,
              fail_code: taskStatus.failCode,
              fail_desc: taskStatus.failDesc
            }
          })
        }
      }
    }

    // Batch update posts
    if (updates.length > 0) {
      for (const update of updates) {
        const { error: updateError } = await supabaseAdmin
          .from('posts')
          .update({
            status: update.status,
            updated_at: update.updated_at,
            ...(update.posted_at && { posted_at: update.posted_at }),
            error_message: update.error_message
          })
          .eq('id', update.id)

        if (updateError) {
          console.error('Error updating post:', updateError)
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${updates.length} task statuses`,
      updates
    })
  } catch (error) {
    console.error('Error updating task statuses:', error)
    return NextResponse.json(
      { error: 'Failed to update task statuses' },
      { status: 500 }
    )
  }
}

// Also handle GET requests for manual triggers
export async function GET() {
  return POST(new NextRequest('http://localhost'))
} 