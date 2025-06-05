import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { geelarkApi } from '@/lib/geelark-api'

export async function POST(request: NextRequest) {
  try {
    const { accountId, remark, tags } = await request.json()

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch GeeLark profile id & phone record
    const { data: account } = await supabase
      .from('accounts')
      .select('geelark_profile_id, id')
      .eq('id', accountId)
      .single()

    if (!account || !account.geelark_profile_id) {
      return NextResponse.json({ error: 'Account not found or missing GeeLark profile id' }, { status: 404 })
    }

    // Update remark on GeeLark (tags are not supported for updates)
    if (remark !== undefined) {
      try {
        await geelarkApi.updatePhoneDetails(account.geelark_profile_id, { remark })
      } catch (error) {
        console.error('Failed to update GeeLark remark:', error)
        // Continue even if GeeLark update fails - we'll still update locally
      }
    }

    // Note: GeeLark's update API only supports tagIDs (existing tag IDs), not tagsName
    // Tags can only be set during profile creation with tagsName
    // We maintain tags locally in Supabase for flexibility

    // Persist locally in phones table
    const updatePhones: any = {}
    if (remark !== undefined) updatePhones.remark = remark
    if (Array.isArray(tags)) updatePhones.tags = tags

    await supabase
      .from('phones')
      .update(updatePhones)
      .eq('account_id', accountId)

    // Log
    await supabase.from('logs').insert({
      level: 'info',
      component: 'api-update-phone-metadata',
      account_id: accountId,
      message: 'Phone metadata updated',
      meta: { 
        remark, 
        tags,
        note: 'Tags are managed locally. GeeLark only supports tagIDs for existing tags.'
      }
    })

    return NextResponse.json({ 
      success: true,
      note: 'Tags are managed locally in Supabase. GeeLark tags can only be set during profile creation.'
    })
  } catch (error) {
    console.error('update-metadata error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
} 