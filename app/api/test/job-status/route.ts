import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent jobs with their images
    const { data: jobs, error } = await supabase
      .from('image_generation_jobs')
      .select(`
        *,
        generated_images:generated_carousel_images(count)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        progress: job.progress,
        message: job.message,
        variants: job.variants,
        imageCount: job.generated_images?.[0]?.count || 0,
        created_at: job.created_at,
        completed_at: job.completed_at
      }))
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch job status' },
      { status: 500 }
    )
  }
} 