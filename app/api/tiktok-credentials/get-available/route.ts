import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createClient()

    // First check the authentication method
    const { data: settingData } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'geelark_auth_method')
      .single()

    const authMethod = settingData?.value || 'daisysms'

    if (authMethod !== 'tiktok') {
      return NextResponse.json(
        { error: 'Authentication method is not set to TikTok credentials' },
        { status: 400 }
      )
    }

    // Get an available TikTok credential (not used recently)
    const { data: credentials, error } = await supabase
      .from('tiktok_credentials')
      .select('*')
      .eq('status', 'active')
      .order('last_used_at', { ascending: true, nullsFirst: true })
      .limit(1)

    if (error) {
      console.error('Error fetching TikTok credentials:', error)
      return NextResponse.json(
        { error: 'Failed to fetch credentials' },
        { status: 500 }
      )
    }

    if (!credentials || credentials.length === 0) {
      return NextResponse.json(
        { error: 'No available TikTok credentials found' },
        { status: 404 }
      )
    }

    const credential = credentials[0]

    // Update last_used_at timestamp
    await supabase
      .from('tiktok_credentials')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', credential.id)

    return NextResponse.json({
      email: credential.email,
      password: credential.password,
      id: credential.id
    })
  } catch (error) {
    console.error('Error in get-available:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 