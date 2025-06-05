// Quick script to fix stuck profiles
// Run with: npx tsx scripts/fix-stuck-profiles.ts

async function fixStuckProfiles() {
  const response = await fetch('http://localhost:3001/api/profiles/fix-stuck-status', {
    method: 'GET'
  })
  
  const data = await response.json()
  console.log('Found stuck profiles:', data)
  
  if (data.profiles && data.profiles.length > 0) {
    const profileIds = data.profiles.map((p: any) => p.id)
    
    console.log(`Fixing ${profileIds.length} stuck profiles...`)
    
    const fixResponse = await fetch('http://localhost:3001/api/profiles/fix-stuck-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        profileIds,
        action: 'mark-active'
      })
    })
    
    const result = await fixResponse.json()
    console.log('Fix result:', result)
  } else {
    console.log('No stuck profiles found!')
  }
}

fixStuckProfiles().catch(console.error) 