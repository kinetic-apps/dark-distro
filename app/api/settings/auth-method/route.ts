import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'geelark_auth_method')
      .single()

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error
    }

    const authMethod = data?.value?.replace(/"/g, '') || 'daisysms'

    return NextResponse.json({ authMethod })
  } catch (error) {
    console.error('Error fetching auth method:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auth method' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { authMethod } = body

    if (!authMethod || !['daisysms', 'tiktok'].includes(authMethod)) {
      return NextResponse.json(
        { error: 'Invalid auth method' },
        { status: 400 }
      )
    }

    // Check if setting exists
    const { data: existing } = await supabaseAdmin
      .from('app_settings')
      .select('id')
      .eq('key', 'geelark_auth_method')
      .single()

    if (existing) {
      // Update existing setting
      const { error } = await supabaseAdmin
        .from('app_settings')
        .update({ 
          value: JSON.stringify(authMethod),
          updated_at: new Date().toISOString()
        })
        .eq('key', 'geelark_auth_method')

      if (error) throw error
    } else {
      // Create new setting
      const { error } = await supabaseAdmin
        .from('app_settings')
        .insert({
          key: 'geelark_auth_method',
          value: JSON.stringify(authMethod),
          description: 'Authentication method for GeeLark TikTok login'
        })

      if (error) throw error
    }

    await supabaseAdmin.from('logs').insert({
      level: 'info',
      component: 'api-settings',
      message: 'Auth method updated',
      meta: { authMethod }
    })

    return NextResponse.json({ success: true, authMethod })
  } catch (error) {
    console.error('Error updating auth method:', error)
    return NextResponse.json(
      { error: 'Failed to update auth method' },
      { status: 500 }
    )
  }
} 