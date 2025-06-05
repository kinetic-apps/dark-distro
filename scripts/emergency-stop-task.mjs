#!/usr/bin/env node

import { config } from 'dotenv';
import { GeeLarkAPI } from '../lib/geelark-api.js';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config({ path: '.env.local' });

// Initialize GeeLark API
const geelarkApi = new GeeLarkAPI();

async function emergencyStop() {
  const taskId = '569651225419579499';
  const profileId = '569614985039183979';
  
  console.log('EMERGENCY STOP PROCEDURE');
  console.log('========================');
  console.log(`Task ID: ${taskId}`);
  console.log(`Profile ID: ${profileId}`);
  console.log('');

  try {
    // Step 1: Try to cancel the task
    console.log('Step 1: Attempting to cancel task...');
    try {
      const cancelResult = await geelarkApi.cancelTasks([taskId]);
      console.log('Cancel result:', JSON.stringify(cancelResult, null, 2));
    } catch (error) {
      console.error('Failed to cancel task:', error.message);
    }

    // Step 2: Force stop the phone regardless
    console.log('\nStep 2: Force stopping phone...');
    try {
      const stopResult = await geelarkApi.stopPhones([profileId]);
      console.log('Stop result:', JSON.stringify(stopResult, null, 2));
      
      if (stopResult.failAmount > 0) {
        console.error('Failed to stop phone:', stopResult.failDetails);
        
        // If phone is executing task, wait a bit and try again
        if (stopResult.failDetails?.[0]?.code === 43005) {
          console.log('\nPhone is executing task. Waiting 5 seconds and trying again...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const retryResult = await geelarkApi.stopPhones([profileId]);
          console.log('Retry result:', JSON.stringify(retryResult, null, 2));
        }
      }
    } catch (error) {
      console.error('Failed to stop phone:', error.message);
    }

    // Step 3: Check current status
    console.log('\nStep 3: Checking current status...');
    try {
      const statusResult = await geelarkApi.getPhoneStatus([profileId]);
      console.log('Phone status:', JSON.stringify(statusResult, null, 2));
      
      const phoneStatus = statusResult.successDetails?.[0]?.status;
      if (phoneStatus === 2) {
        console.log('✅ Phone is now shut down');
      } else if (phoneStatus === 0) {
        console.log('⚠️  Phone is still running. You may need to:');
        console.log('   1. Wait for the task to complete');
        console.log('   2. Use the Geelark web dashboard to force stop');
        console.log('   3. Contact Geelark support if the phone is stuck');
      }
    } catch (error) {
      console.error('Failed to check status:', error.message);
    }

    // Step 4: Update database to mark as error
    console.log('\nStep 4: Updating database...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Update task status
    await supabase
      .from('tasks')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
        meta: {
          cancelled_reason: 'Emergency stop requested',
          original_task_id: taskId
        }
      })
      .eq('geelark_task_id', taskId);

    // Update account status if needed
    const { data: account } = await supabase
      .from('accounts')
      .select('id')
      .eq('geelark_profile_id', profileId)
      .single();

    if (account) {
      await supabase
        .from('accounts')
        .update({
          status: 'error',
          last_error: 'Emergency stop - task cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', account.id);
    }

    console.log('\n✅ Emergency stop procedure completed');
    
  } catch (error) {
    console.error('\n❌ Emergency stop failed:', error);
  }
}

// Run immediately
emergencyStop().catch(console.error); 