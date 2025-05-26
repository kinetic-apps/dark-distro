import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { profileId, variantId, postId } = await request.json()
    
    if (!profileId || !variantId) {
      return NextResponse.json({ 
        error: 'Profile ID and Variant ID required' 
      }, { status: 400 })
    }

    const supabase = await createClient()

    // Update variant status
    const { error: variantError } = await supabase
      .from('carousel_variants')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString()
      })
      .eq('id', variantId)
      .eq('assigned_profile_id', profileId)

    if (variantError) {
      console.error('Error updating variant:', variantError)
      return NextResponse.json({ 
        error: 'Failed to update variant status' 
      }, { status: 500 })
    }

    // Update assignment record
    const { error: assignmentError } = await supabase
      .from('variant_assignments')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        post_id: postId || null
      })
      .eq('variant_id', variantId)
      .eq('profile_id', profileId)

    if (assignmentError) {
      console.error('Error updating assignment:', assignmentError)
      return NextResponse.json({ 
        error: 'Failed to update assignment record' 
      }, { status: 500 })
    }

    // Log the successful posting
    await supabase
      .from('logs')
      .insert({
        level: 'info',
        component: 'geelark-posting',
        message: `Successfully posted variant ${variantId} from profile ${profileId}`,
        meta: {
          variant_id: variantId,
          profile_id: profileId,
          post_id: postId,
          action: 'variant_posted'
        }
      })

    return NextResponse.json({
      success: true,
      message: 'Variant marked as posted'
    })

  } catch (error) {
    console.error('Mark variant posted error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark variant as posted' },
      { status: 500 }
    )
  }
} 