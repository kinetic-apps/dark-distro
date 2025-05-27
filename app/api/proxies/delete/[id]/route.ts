import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params
    
    // First check if the proxy exists and get its details
    const { data: proxy, error: fetchError } = await supabase
      .from('proxies')
      .select('*')
      .eq('id', id)
      .single()
    
    if (fetchError || !proxy) {
      return NextResponse.json(
        { error: 'Proxy not found' },
        { status: 404 }
      )
    }
    
    // Check if proxy is assigned to an account
    if (proxy.assigned_account_id) {
      return NextResponse.json(
        { error: 'Cannot delete proxy that is assigned to an account. Please unassign it first.' },
        { status: 400 }
      )
    }
    
    // Delete the proxy
    const { error: deleteError } = await supabase
      .from('proxies')
      .delete()
      .eq('id', id)
    
    if (deleteError) {
      console.error('Error deleting proxy:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete proxy' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in delete proxy:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 