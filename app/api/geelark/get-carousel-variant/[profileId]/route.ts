import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ profileId: string }> }
) {
  try {
    const { profileId } = await params
    
    if (!profileId) {
      return NextResponse.json({ error: 'Profile ID required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Check if profile exists in accounts table
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .select('id, geelark_profile_id, status')
      .eq('geelark_profile_id', profileId)
      .single()

    if (accountError || !account) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Check if account is active
    if (account.status !== 'active') {
      return NextResponse.json({ 
        error: 'Account not active', 
        status: account.status 
      }, { status: 400 })
    }

    // Get the next available variant that hasn't been assigned to this profile
    const { data: availableVariant, error: variantError } = await supabase
      .from('carousel_variants')
      .select(`
        *,
        variant_slides (
          *
        )
      `)
      .eq('status', 'ready')
      .is('assigned_profile_id', null)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    if (variantError || !availableVariant) {
      // Check if there are any variants assigned to this profile already
      const { data: assignedVariants } = await supabase
        .from('carousel_variants')
        .select('id')
        .eq('assigned_profile_id', profileId)
        .eq('status', 'assigned')

      if (assignedVariants && assignedVariants.length > 0) {
        return NextResponse.json({ 
          error: 'Profile already has assigned variants',
          assignedCount: assignedVariants.length
        }, { status: 400 })
      }

      return NextResponse.json({ 
        error: 'No available variants found' 
      }, { status: 404 })
    }

    // Sort slides by order
    const sortedSlides = availableVariant.variant_slides?.sort(
      (a: any, b: any) => a.slide_order - b.slide_order
    ) || []

    // Assign the variant to this profile
    const { error: updateError } = await supabase
      .from('carousel_variants')
      .update({
        status: 'assigned',
        assigned_profile_id: profileId,
        assigned_at: new Date().toISOString()
      })
      .eq('id', availableVariant.id)

    if (updateError) {
      console.error('Error assigning variant:', updateError)
      return NextResponse.json({ 
        error: 'Failed to assign variant' 
      }, { status: 500 })
    }

    // Create assignment record
    const { error: assignmentError } = await supabase
      .from('variant_assignments')
      .insert({
        variant_id: availableVariant.id,
        profile_id: profileId,
        account_id: account.id,
        status: 'pending'
      })

    if (assignmentError) {
      console.error('Error creating assignment:', assignmentError)
      // Rollback the variant assignment
      await supabase
        .from('carousel_variants')
        .update({
          status: 'ready',
          assigned_profile_id: null,
          assigned_at: null
        })
        .eq('id', availableVariant.id)

      return NextResponse.json({ 
        error: 'Failed to create assignment record' 
      }, { status: 500 })
    }

    // Return the variant with sorted slides
    return NextResponse.json({
      success: true,
      variant: {
        id: availableVariant.id,
        variant_id: availableVariant.variant_id,
        folder_path: availableVariant.folder_path,
        slide_count: availableVariant.slide_count,
        slides: sortedSlides.map((slide: any) => ({
          order: slide.slide_order,
          filename: slide.filename,
          url: slide.image_url,
          width: slide.width,
          height: slide.height,
          caption: slide.caption,
          alt_text: slide.alt_text
        })),
        metadata: availableVariant.metadata
      }
    })

  } catch (error) {
    console.error('Get carousel variant error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get variant' },
      { status: 500 }
    )
  }
} 