import { supabaseAdmin } from '@/lib/supabase/admin'
import { geelarkApi } from '@/lib/geelark-api'

/**
 * Cleanup utility for handling stuck or abandoned batch operations
 */
export async function cleanupStuckBatchPhones(batchId?: string): Promise<void> {
  try {
    // Find accounts that have been in processing state for too long (> 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()
    
    let query = supabaseAdmin
      .from('accounts')
      .select('id, geelark_profile_id, status, meta')
      .not('meta->batch_status', 'is', null)
      .in('meta->batch_status', ['processing', 'queued'])
      .lt('meta->batch_updated_at', thirtyMinutesAgo)
    
    if (batchId) {
      query = query.eq('meta->batch_id', batchId)
    }
    
    const { data: stuckAccounts, error } = await query
    
    if (error) {
      console.error('Error finding stuck accounts:', error)
      return
    }
    
    if (!stuckAccounts || stuckAccounts.length === 0) {
      console.log('No stuck accounts found')
      return
    }
    
    console.log(`Found ${stuckAccounts.length} stuck accounts to cleanup`)
    
    for (const account of stuckAccounts) {
      try {
        // Update account status
        await supabaseAdmin
          .from('accounts')
          .update({
            status: 'error',
            last_error: 'Batch operation timed out',
            meta: {
              ...account.meta,
              batch_status: 'timeout',
              batch_error: 'Operation exceeded 30 minute timeout'
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', account.id)
        
        // Try to stop the phone if it's running
        if (account.geelark_profile_id) {
          try {
            const phoneStatus = await geelarkApi.getPhoneStatus([account.geelark_profile_id])
            if (phoneStatus.successDetails?.[0]?.status === 0) {
              // Phone is running, stop it
              await geelarkApi.stopPhones([account.geelark_profile_id])
              console.log(`Stopped stuck phone ${account.geelark_profile_id}`)
            }
          } catch (stopError) {
            console.error(`Failed to stop phone ${account.geelark_profile_id}:`, stopError)
          }
        }
        
        // Log the cleanup
        await supabaseAdmin.from('logs').insert({
          level: 'warning',
          component: 'batch-cleanup',
          message: 'Cleaned up stuck batch account',
          meta: {
            account_id: account.id,
            profile_id: account.geelark_profile_id,
            batch_id: account.meta?.batch_id,
            stuck_duration_minutes: 30
          }
        })
        
      } catch (cleanupError) {
        console.error(`Failed to cleanup account ${account.id}:`, cleanupError)
      }
    }
    
  } catch (error) {
    console.error('Batch cleanup error:', error)
  }
}

/**
 * Check and release DaisySMS rentals that are stuck
 */
export async function cleanupStuckRentals(): Promise<void> {
  try {
    // Find rentals that have been waiting for too long (> 25 minutes)
    const twentyFiveMinutesAgo = new Date(Date.now() - 25 * 60 * 1000).toISOString()
    
    const { data: stuckRentals, error } = await supabaseAdmin
      .from('sms_rentals')
      .select('*')
      .eq('status', 'waiting')
      .lt('created_at', twentyFiveMinutesAgo)
    
    if (error) {
      console.error('Error finding stuck rentals:', error)
      return
    }
    
    if (!stuckRentals || stuckRentals.length === 0) {
      return
    }
    
    console.log(`Found ${stuckRentals.length} stuck rentals to cleanup`)
    
    for (const rental of stuckRentals) {
      try {
        // Cancel the rental to get refund
        const { daisyApi } = await import('@/lib/daisy-api')
        await daisyApi.setStatus(rental.rental_id, '8') // 8 = cancel
        
        // Update rental status
        await supabaseAdmin
          .from('sms_rentals')
          .update({
            status: 'cancelled',
            meta: {
              ...rental.meta,
              cancelled_reason: 'Timeout - no OTP received after 25 minutes'
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', rental.id)
        
        console.log(`Cancelled stuck rental ${rental.rental_id}`)
        
      } catch (cancelError) {
        console.error(`Failed to cancel rental ${rental.rental_id}:`, cancelError)
      }
    }
    
  } catch (error) {
    console.error('Rental cleanup error:', error)
  }
}