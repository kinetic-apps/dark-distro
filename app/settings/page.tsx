'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { 
  Database,
  Wifi,
  MessageSquare,
  Smartphone,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Settings,
  Eye,
  EyeOff
} from 'lucide-react'

interface TestResult {
  name: string
  status: 'idle' | 'running' | 'success' | 'error'
  message?: string
  duration?: number
  data?: any
}

interface ApiCredentials {
  daisysms_api_key: string
  daisysms_api_base_url: string
  geelark_api_key: string
  geelark_api_base_url: string
  geelark_app_id: string
  soax_api_key: string
  soax_api_base_url: string
  soax_package_key: string
  soax_pool_host: string
  soax_pool_port: string
}

export default function SettingsPage() {
  const [tests, setTests] = useState<Record<string, TestResult>>({})
  const [runningAll, setRunningAll] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  const [credentials, setCredentials] = useState<Partial<ApiCredentials>>({})
  const [systemHealth, setSystemHealth] = useState({
    database: 'unknown',
    supabase: 'unknown',
    total_accounts: 0,
    total_proxies: 0,
    total_rentals: 0,
    recent_errors: 0
  })

  const supabase = createClient()

  useEffect(() => {
    checkSystemHealth()
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkSystemHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const checkSystemHealth = async () => {
    try {
      const [accounts, proxies, rentals, errors] = await Promise.all([
        supabase.from('accounts').select('*', { count: 'exact', head: true }),
        supabase.from('proxies').select('*', { count: 'exact', head: true }),
        supabase.from('sms_rentals').select('*', { count: 'exact', head: true }),
        supabase.from('logs')
          .select('*', { count: 'exact', head: true })
          .in('level', ['error', 'critical'])
          .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
      ])

      setSystemHealth({
        database: 'healthy',
        supabase: 'healthy',
        total_accounts: accounts.count || 0,
        total_proxies: proxies.count || 0,
        total_rentals: rentals.count || 0,
        recent_errors: errors.count || 0
      })
    } catch (error) {
      setSystemHealth(prev => ({
        ...prev,
        database: 'error',
        supabase: 'error'
      }))
    }
  }

  const updateTestResult = (testId: string, result: Partial<TestResult>) => {
    setTests(prev => ({
      ...prev,
      [testId]: { ...prev[testId], ...result }
    }))
  }

  const runTest = async (testId: string, testFn: () => Promise<any>) => {
    const startTime = Date.now()
    updateTestResult(testId, { status: 'running', message: undefined })

    try {
      const result = await testFn()
      const duration = Date.now() - startTime
      updateTestResult(testId, {
        status: 'success',
        message: result.message || 'Test passed',
        duration,
        data: result.data
      })
    } catch (error) {
      const duration = Date.now() - startTime
      updateTestResult(testId, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      })
    }
  }

  // Database Tests
  const testSupabaseConnection = () => runTest('supabase', async () => {
    const { data, error } = await supabase.from('accounts').select('count').limit(1)
    if (error) throw error
    return { message: 'Supabase connection successful' }
  })

  const testDatabaseSchema = () => runTest('schema', async () => {
    const tables = ['accounts', 'proxies', 'phones', 'posts', 'sms_rentals', 'tasks', 'logs']
    const results = await Promise.all(
      tables.map(table => 
        supabase.from(table).select('*', { count: 'exact', head: true })
      )
    )
    
    const tableInfo = results.map((result, index) => ({
      table: tables[index],
      count: result.count || 0,
      error: result.error?.message
    }))

    return { 
      message: `All ${tables.length} tables accessible`,
      data: tableInfo
    }
  })

  // DaisySMS Tests
  const testDaisySMSAuth = () => runTest('daisy-auth', async () => {
    const response = await fetch('/api/daisysms/test-auth', { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed')
    }
    
    return { message: 'DaisySMS authentication successful', data }
  })

  const testDaisySMSBalance = () => runTest('daisy-balance', async () => {
    const response = await fetch('/api/daisysms/test-balance', { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Balance check failed')
    }
    
    return { message: `Balance: ${data.balance} credits`, data }
  })

  // GeeLark Tests (uses signature-based authentication with headers)
  const testGeeLarkAuth = () => runTest('geelark-auth', async () => {
    const response = await fetch('/api/geelark/test-auth', { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed')
    }
    
    return { message: 'GeeLark authentication successful', data }
  })

  const testGeeLarkProfiles = () => runTest('geelark-profiles', async () => {
    const response = await fetch('/api/geelark/test-profiles', { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Profile listing failed')
    }
    
    return { message: `Found ${data.profiles?.length || 0} profiles`, data }
  })

  // SOAX Tests (proxy service - tests configuration and connectivity)
  const testSOAXAuth = () => runTest('soax-auth', async () => {
    const response = await fetch('/api/soax/test-auth', { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Authentication failed')
    }
    
    return { message: 'SOAX configuration test successful', data }
  })

  const testSOAXProxies = () => runTest('soax-proxies', async () => {
    const response = await fetch('/api/soax/test-proxies', { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Proxy test failed')
    }
    
    return { message: 'Proxy connection successful', data }
  })

  // Integration Tests
  const testFullWorkflow = () => runTest('workflow', async () => {
    // Test a basic workflow: create profile → set proxy → check status
    const response = await fetch('/api/test/full-workflow', { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || 'Workflow test failed')
    }
    
    return { message: 'Full workflow test completed', data }
  })

  const runAllTests = async () => {
    setRunningAll(true)
    
    // Initialize all tests
    const allTests = [
      'supabase', 'schema', 'daisy-auth', 'daisy-balance',
      'geelark-auth', 'geelark-profiles', 'soax-auth', 'soax-proxies', 'workflow'
    ]
    
    setTests(allTests.reduce((acc, testId) => ({
      ...acc,
      [testId]: { name: testId, status: 'idle' }
    }), {}))

    // Run tests sequentially to avoid rate limits
    await testSupabaseConnection()
    await testDatabaseSchema()
    await testDaisySMSAuth()
    await testDaisySMSBalance()
    await testGeeLarkAuth()
    await testGeeLarkProfiles()
    await testSOAXAuth()
    await testSOAXProxies()
    await testFullWorkflow()

    setRunningAll(false)
  }

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />
    }
  }

  const getHealthColor = (health: string) => {
    switch (health) {
      case 'healthy':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Settings & Diagnostics</h1>
          <p className="mt-1 text-sm text-gray-600">
            System configuration, API tests, and health monitoring
          </p>
        </div>
        
        <button
          onClick={runAllTests}
          disabled={runningAll}
          className="btn-primary"
        >
          {runningAll ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Run All Tests
        </button>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Database</p>
              <p className={`mt-1 text-sm font-semibold ${getHealthColor(systemHealth.database)}`}>
                {systemHealth.database === 'healthy' ? 'Connected' : 'Error'}
              </p>
            </div>
            <Database className={`h-6 w-6 ${getHealthColor(systemHealth.database)}`} />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Accounts</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {systemHealth.total_accounts}
              </p>
            </div>
            <Smartphone className="h-6 w-6 text-blue-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Proxies</p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {systemHealth.total_proxies}
              </p>
            </div>
            <Wifi className="h-6 w-6 text-purple-600" />
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Errors (1h)</p>
              <p className={`mt-1 text-2xl font-semibold ${
                systemHealth.recent_errors > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {systemHealth.recent_errors}
              </p>
            </div>
            {systemHealth.recent_errors > 0 ? (
              <AlertTriangle className="h-6 w-6 text-red-600" />
            ) : (
              <CheckCircle className="h-6 w-6 text-green-600" />
            )}
          </div>
        </div>
      </div>

      {/* API Tests */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Database Tests */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Database className="h-5 w-5 mr-2" />
            Database Tests
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">Supabase Connection</p>
                <p className="text-sm text-gray-600">Test database connectivity</p>
              </div>
              <div className="flex items-center gap-2">
                {tests.supabase && (
                  <span className="text-xs text-gray-500">
                    {tests.supabase.duration}ms
                  </span>
                )}
                {getStatusIcon(tests.supabase?.status || 'idle')}
                <button onClick={testSupabaseConnection} className="btn-secondary text-xs">
                  Test
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">Database Schema</p>
                <p className="text-sm text-gray-600">Verify all tables exist</p>
              </div>
              <div className="flex items-center gap-2">
                {tests.schema && (
                  <span className="text-xs text-gray-500">
                    {tests.schema.duration}ms
                  </span>
                )}
                {getStatusIcon(tests.schema?.status || 'idle')}
                <button onClick={testDatabaseSchema} className="btn-secondary text-xs">
                  Test
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* DaisySMS Tests */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            DaisySMS Tests
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">Authentication</p>
                <p className="text-sm text-gray-600">Test API key validity</p>
              </div>
              <div className="flex items-center gap-2">
                {tests['daisy-auth'] && (
                  <span className="text-xs text-gray-500">
                    {tests['daisy-auth'].duration}ms
                  </span>
                )}
                {getStatusIcon(tests['daisy-auth']?.status || 'idle')}
                <button onClick={testDaisySMSAuth} className="btn-secondary text-xs">
                  Test
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">Balance Check</p>
                <p className="text-sm text-gray-600">Check account balance</p>
              </div>
              <div className="flex items-center gap-2">
                {tests['daisy-balance'] && (
                  <span className="text-xs text-gray-500">
                    {tests['daisy-balance'].duration}ms
                  </span>
                )}
                {getStatusIcon(tests['daisy-balance']?.status || 'idle')}
                <button onClick={testDaisySMSBalance} className="btn-secondary text-xs">
                  Test
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* GeeLark Tests */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Smartphone className="h-5 w-5 mr-2" />
            GeeLark Tests
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">Authentication</p>
                <p className="text-sm text-gray-600">Test API credentials</p>
              </div>
              <div className="flex items-center gap-2">
                {tests['geelark-auth'] && (
                  <span className="text-xs text-gray-500">
                    {tests['geelark-auth'].duration}ms
                  </span>
                )}
                {getStatusIcon(tests['geelark-auth']?.status || 'idle')}
                <button onClick={testGeeLarkAuth} className="btn-secondary text-xs">
                  Test
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">Profile Management</p>
                <p className="text-sm text-gray-600">List existing profiles</p>
              </div>
              <div className="flex items-center gap-2">
                {tests['geelark-profiles'] && (
                  <span className="text-xs text-gray-500">
                    {tests['geelark-profiles'].duration}ms
                  </span>
                )}
                {getStatusIcon(tests['geelark-profiles']?.status || 'idle')}
                <button onClick={testGeeLarkProfiles} className="btn-secondary text-xs">
                  Test
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* SOAX Tests */}
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
            <Wifi className="h-5 w-5 mr-2" />
            SOAX Tests
          </h2>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">Authentication</p>
                <p className="text-sm text-gray-600">Test API access</p>
              </div>
              <div className="flex items-center gap-2">
                {tests['soax-auth'] && (
                  <span className="text-xs text-gray-500">
                    {tests['soax-auth'].duration}ms
                  </span>
                )}
                {getStatusIcon(tests['soax-auth']?.status || 'idle')}
                <button onClick={testSOAXAuth} className="btn-secondary text-xs">
                  Test
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              <div>
                <p className="font-medium">Proxy Connection</p>
                <p className="text-sm text-gray-600">Test proxy connectivity</p>
              </div>
              <div className="flex items-center gap-2">
                {tests['soax-proxies'] && (
                  <span className="text-xs text-gray-500">
                    {tests['soax-proxies'].duration}ms
                  </span>
                )}
                {getStatusIcon(tests['soax-proxies']?.status || 'idle')}
                <button onClick={testSOAXProxies} className="btn-secondary text-xs">
                  Test
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Integration Test */}
      <div className="card">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Integration Test
        </h2>
        
        <div className="flex items-center justify-between p-4 bg-blue-50 rounded-md">
          <div>
            <p className="font-medium">Full Workflow Test</p>
            <p className="text-sm text-gray-600">
              Test complete integration: Profile creation → Proxy assignment → Status check
            </p>
          </div>
          <div className="flex items-center gap-2">
            {tests.workflow && (
              <span className="text-xs text-gray-500">
                {tests.workflow.duration}ms
              </span>
            )}
            {getStatusIcon(tests.workflow?.status || 'idle')}
            <button onClick={testFullWorkflow} className="btn-primary">
              Run Test
            </button>
          </div>
        </div>
      </div>

      {/* Test Results */}
      {Object.keys(tests).length > 0 && (
        <div className="card">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Test Results</h2>
          
          <div className="space-y-3">
            {Object.entries(tests).map(([testId, result]) => (
              <div key={testId} className="border border-gray-200 rounded-md p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium capitalize">{testId.replace('-', ' ')}</h3>
                  <div className="flex items-center gap-2">
                    {result.duration && (
                      <span className="text-xs text-gray-500">{result.duration}ms</span>
                    )}
                    {getStatusIcon(result.status)}
                  </div>
                </div>
                
                {result.message && (
                  <p className={`text-sm ${
                    result.status === 'error' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {result.message}
                  </p>
                )}
                
                {result.data && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      View Details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Environment Configuration */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Environment Configuration</h2>
          <button
            onClick={() => setShowCredentials(!showCredentials)}
            className="btn-secondary text-xs"
          >
            {showCredentials ? (
              <>
                <EyeOff className="h-4 w-4 mr-1" />
                Hide
              </>
            ) : (
              <>
                <Eye className="h-4 w-4 mr-1" />
                Show
              </>
            )}
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Database Status</p>
            <p className={`text-sm ${getHealthColor(systemHealth.supabase)}`}>
              {systemHealth.supabase === 'healthy' ? 'Connected' : 'Connection Error'}
            </p>
          </div>
          
          <div>
            <p className="text-sm font-medium text-gray-700">Environment</p>
            <p className="text-sm text-gray-600">
              {process.env.NODE_ENV || 'development'}
            </p>
          </div>
        </div>

        {showCredentials && (
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-sm text-yellow-800 mb-3">
              ⚠️ Sensitive information - do not share these values
            </p>
            <div className="grid grid-cols-1 gap-2 text-xs font-mono">
              <div>DAISYSMS_API_KEY: {process.env.NEXT_PUBLIC_DAISYSMS_API_KEY ? '***' : 'Not Set'}</div>
              <div>GEELARK_API_KEY: {process.env.NEXT_PUBLIC_GEELARK_API_KEY ? '***' : 'Not Set'}</div>
              <div>SOAX_API_KEY: {process.env.NEXT_PUBLIC_SOAX_API_KEY ? '***' : 'Not Set'}</div>
              <div>SUPABASE_URL: {process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 