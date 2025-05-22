import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

// This endpoint would be called by a Supabase Edge Function
// when a new file is uploaded to the ghostpost-outbox bucket
export async function POST(request: NextRequest) {
  let requestBody: any = undefined
  
  try {
    const body = await request.json()
    requestBody = body
    const { bucket, name, metadata } = body

    if (bucket !== 'ghostpost-outbox') {
      return NextResponse.json({ success: true })
    }

    // Check if it's a manifest file
    if (name.endsWith('_manifest.json')) {
      // Find the corresponding video file
      const videoName = name.replace('_manifest.json', '.mp4')
      
      // Download and parse manifest
      const { data: manifestData, error: manifestError } = await supabaseAdmin
        .storage
        .from('ghostpost-outbox')
        .download(name)

      if (!manifestError && manifestData) {
        const manifestText = await manifestData.text()
        const manifest = JSON.parse(manifestText)

        // Find available accounts for posting
        const { data: availableAccounts } = await supabaseAdmin
          .from('accounts')
          .select('id')
          .eq('status', 'active')
          .eq('warmup_done', true)
          .order('updated_at', { ascending: true })
          .limit(1)

        if (availableAccounts && availableAccounts.length > 0) {
          // Create post record
          const { data: post, error: postError } = await supabaseAdmin
            .from('posts')
            .insert({
              account_id: availableAccounts[0].id,
              asset_path: videoName,
              caption: manifest.caption || '',
              hashtags: manifest.hashtags || [],
              status: 'queued'
            })
            .select()
            .single()

          if (!postError && post) {
            // Trigger post immediately
            await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/geelark/start-post`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ post_id: post.id })
            })

            await supabaseAdmin.from('logs').insert({
              level: 'info',
              component: 'storage-trigger',
              account_id: availableAccounts[0].id,
              message: 'Auto-posted new content',
              meta: { 
                asset: videoName,
                post_id: post.id,
                manifest
              }
            })
          }
        } else {
          await supabaseAdmin.from('logs').insert({
            level: 'warning',
            component: 'storage-trigger',
            message: 'No available accounts for auto-posting',
            meta: { asset: videoName }
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Storage trigger error:', error)
    
    await supabaseAdmin.from('logs').insert({
      level: 'error',
      component: 'storage-trigger',
      message: 'Failed to handle storage upload',
      meta: { error: String(error), body: requestBody }
    })

    return NextResponse.json(
      { error: 'Failed to handle upload' },
      { status: 500 }
    )
  }
}