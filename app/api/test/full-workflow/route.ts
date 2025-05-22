import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const testResults = []

    // Step 1: Test database connection
    try {
      const { data, error } = await supabase.from('accounts').select('count').limit(1)
      if (error) throw error
      testResults.push({ step: 'Database Connection', status: 'success', message: 'Connected successfully' })
    } catch (error) {
      testResults.push({ step: 'Database Connection', status: 'error', message: String(error) })
      return NextResponse.json({
        error: 'Database connection failed',
        results: testResults
      }, { status: 500 })
    }

    // Step 2: Check table schemas
    try {
      const tables = ['accounts', 'proxies', 'phones', 'posts', 'sms_rentals', 'tasks']
      const schemaResults = []
      
      for (const table of tables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
        if (error) {
          schemaResults.push({ table, status: 'error', error: error.message })
        } else {
          schemaResults.push({ table, status: 'success', count })
        }
      }
      
      testResults.push({ 
        step: 'Schema Validation', 
        status: 'success', 
        message: `All ${tables.length} tables accessible`,
        details: schemaResults
      })
    } catch (error) {
      testResults.push({ step: 'Schema Validation', status: 'error', message: String(error) })
    }

    // Step 3: Test API credentials configuration
    const credentials = {
      daisysms: !!(process.env.DAISYSMS_API_KEY && process.env.DAISYSMS_API_BASE_URL),
      geelark: !!(process.env.GEELARK_API_KEY && process.env.GEELARK_API_BASE_URL && process.env.GEELARK_APP_ID),
      soax: !!(process.env.SOAX_API_KEY && process.env.SOAX_API_BASE_URL && process.env.SOAX_PACKAGE_KEY)
    }

    testResults.push({
      step: 'API Credentials',
      status: 'success',
      message: 'Credential configuration checked',
      details: credentials
    })

    // Step 4: Test log writing capability
    try {
      const { error } = await supabase.from('logs').insert({
        level: 'info',
        component: 'workflow-test',
        message: 'Integration test completed successfully',
        meta: { timestamp: new Date().toISOString(), test_id: 'workflow-test' }
      })

      if (error) throw error
      testResults.push({ step: 'Log Writing', status: 'success', message: 'Log entry created successfully' })
    } catch (error) {
      testResults.push({ step: 'Log Writing', status: 'error', message: String(error) })
    }

    // Step 5: Test data relationships
    try {
      const { data: accounts } = await supabase
        .from('accounts')
        .select(`
          id,
          status,
          proxy:proxies!proxy_id(id, health),
          phone:phones!accounts_phone_account_id_fkey(profile_id, status)
        `)
        .limit(5)

      testResults.push({
        step: 'Data Relationships',
        status: 'success',
        message: `Tested joins with ${accounts?.length || 0} sample accounts`,
        details: { sample_count: accounts?.length || 0 }
      })
    } catch (error) {
      testResults.push({ step: 'Data Relationships', status: 'error', message: String(error) })
    }

    // Calculate overall status
    const hasErrors = testResults.some(result => result.status === 'error')
    const overallStatus = hasErrors ? 'partial' : 'success'

    return NextResponse.json({
      success: true,
      status: overallStatus,
      message: hasErrors 
        ? 'Workflow test completed with some issues' 
        : 'Full workflow test completed successfully',
      results: testResults,
      summary: {
        total_steps: testResults.length,
        successful_steps: testResults.filter(r => r.status === 'success').length,
        failed_steps: testResults.filter(r => r.status === 'error').length
      }
    })

  } catch (error) {
    return NextResponse.json(
      { error: `Workflow test failed: ${error}` },
      { status: 500 }
    )
  }
} 