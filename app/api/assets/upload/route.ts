import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const assetType = formData.get('type') as string || 'other'
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    const acceptedTypes = [
      'image/jpeg', 'image/png', 'image/webp',
      'application/json',
      'video/mp4', 'video/quicktime', 'video/x-msvideo', 
      'video/x-matroska', 'video/webm'
    ]
    
    if (!acceptedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })
    }

    // Validate file size (100MB limit)
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large (max 100MB)' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}_${uuidv4()}.${fileExt}`
    
    // Determine storage path - use generated-carousels bucket for all uploads
    let storagePath: string
    const bucketName = 'generated-carousels'
    
    if (file.type.startsWith('video/')) {
      storagePath = `${user.id}/manual-uploads/videos/${fileName}`
    } else if (file.type.startsWith('image/')) {
      storagePath = `${user.id}/manual-uploads/images/${fileName}`
    } else {
      storagePath = `${user.id}/manual-uploads/other/${fileName}`
    }

    // Upload file to storage
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(storagePath)

    // Create database records based on asset type
    if (assetType === 'carousel' && file.type.startsWith('image/')) {
      // Create a manual upload job record
      const { data: job, error: jobError } = await supabase
        .from('image_generation_jobs')
        .insert({
          name: `Manual Upload - ${file.name}`,
          template_name: 'Manual Upload',
          template_description: 'Manually uploaded asset',
          status: 'completed',
          progress: 100,
          message: 'Manual upload completed',
          variants: 1,
          prompt: 'Manually uploaded asset',
          settings: {
            source: 'manual_upload',
            original_filename: file.name,
            file_type: file.type,
            file_size: file.size
          },
          completed_at: new Date().toISOString(),
          user_id: user.id
        })
        .select()
        .single()

      if (jobError) {
        console.error('Job creation error:', jobError)
        return NextResponse.json({ error: 'Failed to create job record' }, { status: 500 })
      }

      // Create carousel variant
      const variantId = uuidv4()
      const { data: variant, error: variantError } = await supabase
        .from('carousel_variants')
        .insert({
          job_id: job.id,
          variant_index: 0,
          variant_id: variantId,
          folder_path: storagePath,
          slide_count: 1,
          status: 'ready',
          metadata: {
            source: 'manual_upload',
            original_filename: file.name
          }
        })
        .select()
        .single()

      if (variantError) {
        console.error('Variant creation error:', variantError)
        return NextResponse.json({ error: 'Failed to create variant record' }, { status: 500 })
      }

      // Create slide record using the returned variant's id
      const { error: slideError } = await supabase
        .from('variant_slides')
        .insert({
          variant_id: variant.id,  // Use the actual id from the database, not the variant_id field
          slide_order: 0,
          filename: fileName,
          storage_path: storagePath,
          image_url: publicUrl
        })

      if (slideError) {
        console.error('Slide creation error:', slideError)
        return NextResponse.json({ error: 'Failed to create slide record' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        type: 'carousel',
        jobId: job.id,
        variantId,
        url: publicUrl,
        storagePath
      })
      
    } else if (assetType === 'video' && file.type.startsWith('video/')) {
      // For videos, we'll create a simplified record
      // You might want to create a separate videos table or use the existing structure
      const { data: job, error: jobError } = await supabase
        .from('image_generation_jobs')
        .insert({
          name: `Video Upload - ${file.name}`,
          template_name: 'Video Upload',
          template_description: 'Manually uploaded video',
          status: 'completed',
          progress: 100,
          message: 'Video upload completed',
          variants: 1,
          prompt: 'Manually uploaded video',
          settings: {
            source: 'manual_upload',
            asset_type: 'video',
            original_filename: file.name,
            file_type: file.type,
            file_size: file.size,
            video_url: publicUrl,
            storage_path: storagePath
          },
          completed_at: new Date().toISOString(),
          user_id: user.id
        })
        .select()
        .single()

      if (jobError) {
        console.error('Job creation error:', jobError)
        return NextResponse.json({ error: 'Failed to create job record' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        type: 'video',
        jobId: job.id,
        url: publicUrl,
        storagePath
      })
      
    } else {
      // For other file types (JSON, etc.), create a generic record
      const { data: job, error: jobError } = await supabase
        .from('image_generation_jobs')
        .insert({
          name: `File Upload - ${file.name}`,
          template_name: 'File Upload',
          template_description: 'Manually uploaded file',
          status: 'completed',
          progress: 100,
          message: 'File upload completed',
          variants: 1,
          prompt: 'Manually uploaded file',
          settings: {
            source: 'manual_upload',
            asset_type: 'file',
            original_filename: file.name,
            file_type: file.type,
            file_size: file.size,
            file_url: publicUrl,
            storage_path: storagePath
          },
          completed_at: new Date().toISOString(),
          user_id: user.id
        })
        .select()
        .single()

      if (jobError) {
        console.error('Job creation error:', jobError)
        return NextResponse.json({ error: 'Failed to create job record' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        type: 'file',
        jobId: job.id,
        url: publicUrl,
        storagePath
      })
    }

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}