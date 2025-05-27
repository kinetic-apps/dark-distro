import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'geelark_auth_method')
      .single()

    if (error) {
      console.error('Error fetching auth method:', error)
      return NextResponse.json({ method: 'daisysms' }) // Default fallback
    }

    return NextResponse.json({ method: data.value || 'daisysms' })
  } catch (error) {
    console.error('Error in auth-method GET:', error)
    return NextResponse.json({ method: 'daisysms' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { method } = await request.json()

    if (!['daisysms', 'tiktok'].includes(method)) {
      return NextResponse.json(
        { error: 'Invalid authentication method' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from('app_settings')
      .update({ value: JSON.stringify(method) })
      .eq('key', 'geelark_auth_method')

    if (error) {
      console.error('Error updating auth method:', error)
      return NextResponse.json(
        { error: 'Failed to update authentication method' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, method })
  } catch (error) {
    console.error('Error in auth-method POST:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 