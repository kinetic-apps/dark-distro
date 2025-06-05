#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' });

async function findAndStopPhone() {
  const targetIP = '128.14.109.187';
  
  console.log('Finding and stopping Geelark phone');
  console.log('==================================');
  console.log(`Target IP: ${targetIP}`);
  console.log('');

  try {
    // First, let's query all phones to find the one with this IP
    console.log('Step 1: Fetching all phones from database...');
    
    const response = await fetch('http://localhost:3003/api/phones/update-metadata', {
      method: 'GET'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch phones');
    }
    
    const phones = await response.json();
    console.log(`Found ${phones.length} phones in database\n`);
    
    // Look for phone with matching IP in metadata
    let targetPhone = null;
    for (const phone of phones) {
      if (phone.meta?.adb_info?.ip === targetIP) {
        targetPhone = phone;
        break;
      }
    }
    
    if (!targetPhone) {
      console.log('⚠️  Phone not found by ADB IP. Trying to find by other means...\n');
      
      // Alternative: Stop all running phones (be careful with this)
      console.log('Would you like to stop a specific phone? Please provide the profile ID.');
      console.log('You can find this in the Geelark dashboard or your database.');
      return;
    }
    
    console.log(`✓ Found phone: ${targetPhone.profile_name} (${targetPhone.profile_id})\n`);
    
    // Step 2: Stop the phone using the API
    console.log('Step 2: Stopping phone via Geelark API...');
    
    const stopResponse = await fetch('http://localhost:3003/api/geelark/phone-control', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profile_ids: [targetPhone.profile_id],
        action: 'stop'
      })
    });
    
    const stopResult = await stopResponse.json();
    
    if (!stopResponse.ok) {
      throw new Error(stopResult.error || 'Failed to stop phone');
    }
    
    console.log('✅ Stop command sent successfully!');
    console.log('Result:', JSON.stringify(stopResult, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\nAlternative approach: You can manually stop the phone using:');
    console.log('1. The Geelark web dashboard');
    console.log('2. The phone control buttons in your app at http://localhost:3003/profiles');
  }
}

// Run the script
findAndStopPhone(); 