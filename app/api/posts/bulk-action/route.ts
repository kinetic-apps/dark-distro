import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { postIds, action } = await request.json()
    
    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { error: 'Post IDs array is required' },
        { status: 400 }
      )
    }
    
    if (!action || !['cancel', 'delete'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action is required (cancel or delete)' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    
    if (action === 'cancel') {
      const { data, error } = await supabase
        .from('posts')
        .update({ status: 'cancelled' })
        .in('id', postIds)
        .in('status', ['queued', 'pending'])
        .select()
      
      if (error) {
        console.error('Error cancelling posts:', error)
        return NextResponse.json(
          { error: 'Failed to cancel posts' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ 
        success: true, 
        action: 'cancelled',
        count: data?.length || 0,
        data 
      })
    } else if (action === 'delete') {
      const { data, error } = await supabase
        .from('posts')
        .delete()
        .in('id', postIds)
        .in('status', ['cancelled', 'failed'])
        .select()
      
      if (error) {
        console.error('Error deleting posts:', error)
        return NextResponse.json(
          { error: 'Failed to delete posts' },
          { status: 500 }
        )
      }
      
      return NextResponse.json({ 
        success: true, 
        action: 'deleted',
        count: data?.length || 0,
        data 
      })
    }
  } catch (error) {
    console.error('Error in bulk action route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}