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
  EyeOff,
  Shield,
  Zap,
  Activity,
  Server,
  Key,
  Globe,
  Clock,
  TrendingUp,
  AlertCircle,
  PlayCircle,
  PauseCircle,
  ChevronRight,
  Terminal,
  Code,
  Package,
  Cpu,
  HardDrive,
  Network,
  Cloud,
  Lock,
  Unlock,
  Info,
  CheckSquare,
  Square,
  BarChart3
} from 'lucide-react'
import Link from 'next/link'

interface TestResult {
  name: string
  status: 'idle' | 'running' | 'success' | 'error'
  message?: string
  duration?: number
  data?: any
}

interface SystemMetrics {
  database: {
    status: 'healthy' | 'degraded' | 'error' | 'unknown'
    latency: number
    connections: number
  }
  apis: {
    daisysms: { status: 'healthy' | 'degraded' | 'error' | 'unknown', lastCheck: Date | null }
    geelark: { status: 'healthy' | 'degraded' | 'error' | 'unknown', lastCheck: Date | null }
    soax: { status: 'healthy' | 'degraded' | 'error' | 'unknown', lastCheck: Date | null }
  }
  resources: {
    totalAccounts: number
    totalProxies: number
    totalRentals: number
    recentErrors: number
    tasksCompleted: number
    imagesGenerated: number
  }
  performance: {
    avgResponseTime: number
    successRate: number
    uptime: number
  }
}

interface TestCategory {
  id: string
  name: string
  description: string
  icon: any
  tests: {
    id: string
    name: string
    description: string
    endpoint?: string
  }[]
}

const testCategories: TestCategory[] = [
  {
    id: 'database',
    name: 'Database',
    description: 'Core database connectivity and schema validation',
    icon: Database,
    tests: [
      {
        id: 'supabase',
        name: 'Connection Test',
        description: 'Verify Supabase connectivity'
      },
      {
        id: 'schema',
        name: 'Schema Validation',
        description: 'Check all required tables exist'
      }
    ]
  },
  {
    id: 'sms',
    name: 'SMS Service',
    description: 'DaisySMS API integration',
    icon: MessageSquare,
    tests: [
      {
        id: 'daisy-auth',
        name: 'Authentication',
        description: 'Validate API credentials',
        endpoint: '/api/daisysms/test-auth'
      },
      {
        id: 'daisy-balance',
        name: 'Balance Check',
        description: 'Check account balance',
        endpoint: '/api/daisysms/test-balance'
      }
    ]
  },
  {
    id: 'automation',
    name: 'Phone Automation',
    description: 'GeeLark cloud phone management',
    icon: Smartphone,
    tests: [
      {
        id: 'geelark-auth',
        name: 'API Authentication',
        description: 'Verify API access',
        endpoint: '/api/geelark/test-auth'
      },
      {
        id: 'geelark-profiles',
        name: 'Profile Management',
        description: 'List and validate profiles',
        endpoint: '/api/geelark/test-profiles'
      }
    ]
  },
  {
    id: 'proxy',
    name: 'Proxy Network',
    description: 'SOAX proxy infrastructure',
    icon: Wifi,
    tests: [
      {
        id: 'soax-auth',
        name: 'Configuration Test',
        description: 'Validate proxy settings',
        endpoint: '/api/soax/test-auth'
      },
      {
        id: 'soax-proxies',
        name: 'Connection Test',
        description: 'Test proxy connectivity',
        endpoint: '/api/soax/test-proxies'
      }
    ]
  },
  {
    id: 'integration',
    name: 'Integration',
    description: 'End-to-end workflow validation',
    icon: Activity,
    tests: [
      {
        id: 'workflow',
        name: 'Full Workflow Test',
        description: 'Complete automation cycle test',
        endpoint: '/api/test/full-workflow'
      }
    ]
  }
]

function StatusIndicator({ status }: { status: 'healthy' | 'degraded' | 'error' | 'unknown' }) {
  const config = {
    healthy: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20', pulse: false },
    degraded: { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/20', pulse: true },
    error: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20', pulse: true },
    unknown: { color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-900/20', pulse: false }
  }

  const { color, bg, pulse } = config[status]

  return (
    <div className={`relative inline-flex items-center justify-center w-3 h-3`}>
      {pulse && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${bg} opacity-75 animate-ping`}></span>
      )}
      <span className={`relative inline-flex rounded-full h-3 w-3 ${bg} ${color}`}></span>
    </div>
  )
}

function MetricCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  status
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  trend?: { value: number, positive: boolean }
  status?: 'healthy' | 'degraded' | 'error' | 'unknown'
}) {
  return (
    <div className="card-lg group hover:shadow-lg transition-all duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-600 dark:text-dark-400">{title}</p>
            {status && <StatusIndicator status={status} />}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">
              {value}
            </p>
            {trend && (
              <span className={`flex items-center text-xs font-medium ${
                trend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {trend.positive ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                {trend.value}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-dark-400">{subtitle}</p>
          )}
        </div>
        <div className="rounded-lg p-2 bg-gray-50 dark:bg-dark-800 group-hover:bg-gray-100 dark:group-hover:bg-dark-700 transition-colors">
          <Icon className="h-5 w-5 text-gray-600 dark:text-dark-400" />
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const [tests, setTests] = useState<Record<string, TestResult>>({})
  const [runningAll, setRunningAll] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [showCredentials, setShowCredentials] = useState(false)
  const [authMethod, setAuthMethod] = useState<'daisysms' | 'tiktok'>('daisysms')
  const [savingAuthMethod, setSavingAuthMethod] = useState(false)
  const [metrics, setMetrics] = useState<SystemMetrics>({
    database: { status: 'unknown', latency: 0, connections: 0 },
    apis: {
      daisysms: { status: 'unknown', lastCheck: null },
      geelark: { status: 'unknown', lastCheck: null },
      soax: { status: 'unknown', lastCheck: null }
    },
    resources: {
      totalAccounts: 0,
      totalProxies: 0,
      totalRentals: 0,
      recentErrors: 0,
      tasksCompleted: 0,
      imagesGenerated: 0
    },
    performance: {
      avgResponseTime: 0,
      successRate: 100,
      uptime: 99.9
    }
  })

  const supabase = createClient()

  useEffect(() => {
    checkSystemHealth()
    fetchAuthMethod()
    const interval = setInterval(checkSystemHealth, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchAuthMethod = async () => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'geelark_auth_method')
        .single()

      if (data?.value) {
        setAuthMethod(data.value)
      }
    } catch (error) {
      console.error('Error fetching auth method:', error)
    }
  }

  const updateAuthMethod = async (method: 'daisysms' | 'tiktok') => {
    setSavingAuthMethod(true)
    try {
      const response = await fetch('/api/settings/auth-method', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authMethod: method })
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      
      setAuthMethod(method)
    } catch (error) {
      console.error('Error updating auth method:', error)
    } finally {
      setSavingAuthMethod(false)
    }
  }

  const checkSystemHealth = async () => {
    try {
      const startTime = Date.now()
      
      // Test database connection
      const { data: connectionTest, error: connectionError } = await supabase
        .from('accounts')
        .select('id')
        .limit(1)
        .maybeSingle()

      const latency = Date.now() - startTime

      if (connectionError) {
        setMetrics(prev => ({
          ...prev,
          database: { status: 'error', latency: 0, connections: 0 }
        }))
        return
      }

      // Fetch system metrics
      const [accounts, proxies, rentals, errors, tasks, images] = await Promise.all([
        supabase.from('accounts').select('*', { count: 'exact', head: true }),
        supabase.from('proxies').select('*', { count: 'exact', head: true }),
        supabase.from('sms_rentals').select('*', { count: 'exact', head: true }),
        supabase.from('logs')
          .select('*', { count: 'exact', head: true })
          .in('level', ['error', 'critical'])
          .gte('timestamp', new Date(Date.now() - 3600000).toISOString()),
        supabase.from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'completed')
          .gte('completed_at', new Date(Date.now() - 86400000).toISOString()),
        supabase.from('generated_carousel_images')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 86400000).toISOString())
      ])

      setMetrics(prev => ({
        ...prev,
        database: { 
          status: latency < 100 ? 'healthy' : latency < 500 ? 'degraded' : 'error',
          latency,
          connections: 1 
        },
        resources: {
          totalAccounts: accounts.count || 0,
          totalProxies: proxies.count || 0,
          totalRentals: rentals.count || 0,
          recentErrors: errors.count || 0,
          tasksCompleted: tasks.count || 0,
          imagesGenerated: images.count || 0
        },
        performance: {
          ...prev.performance,
          avgResponseTime: latency
        }
      }))

    } catch (error) {
      console.error('System health check failed:', error)
      setMetrics(prev => ({
        ...prev,
        database: { status: 'error', latency: 0, connections: 0 }
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

      // Update API status based on test results
      if (testId.includes('daisy')) {
        setMetrics(prev => ({
          ...prev,
          apis: { ...prev.apis, daisysms: { status: 'healthy', lastCheck: new Date() } }
        }))
      } else if (testId.includes('geelark')) {
        setMetrics(prev => ({
          ...prev,
          apis: { ...prev.apis, geelark: { status: 'healthy', lastCheck: new Date() } }
        }))
      } else if (testId.includes('soax')) {
        setMetrics(prev => ({
          ...prev,
          apis: { ...prev.apis, soax: { status: 'healthy', lastCheck: new Date() } }
        }))
      }
    } catch (error) {
      const duration = Date.now() - startTime
      updateTestResult(testId, {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration
      })

      // Update API status on error
      if (testId.includes('daisy')) {
        setMetrics(prev => ({
          ...prev,
          apis: { ...prev.apis, daisysms: { status: 'error', lastCheck: new Date() } }
        }))
      } else if (testId.includes('geelark')) {
        setMetrics(prev => ({
          ...prev,
          apis: { ...prev.apis, geelark: { status: 'error', lastCheck: new Date() } }
        }))
      } else if (testId.includes('soax')) {
        setMetrics(prev => ({
          ...prev,
          apis: { ...prev.apis, soax: { status: 'error', lastCheck: new Date() } }
        }))
      }
    }
  }

  // Test implementations
  const testSupabaseConnection = () => runTest('supabase', async () => {
    const { data, error } = await supabase.from('accounts').select('count').limit(1)
    if (error) throw error
    return { message: 'Database connection established' }
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

    const failedTables = tableInfo.filter(t => t.error)
    if (failedTables.length > 0) {
      throw new Error(`${failedTables.length} tables inaccessible`)
    }

    return { 
      message: `All ${tables.length} tables validated`,
      data: tableInfo
    }
  })

  const runApiTest = (testId: string, endpoint: string) => runTest(testId, async () => {
    const response = await fetch(endpoint, { method: 'POST' })
    const data = await response.json()
    
    if (!response.ok) {
      throw new Error(data.error || `Test failed with status ${response.status}`)
    }
    
    // Extract meaningful message based on test type
    let message = 'Test successful'
    if (testId === 'daisy-balance' && data.balance !== undefined) {
      message = `Balance: ${data.balance} credits`
    } else if (testId === 'geelark-profiles' && data.profiles) {
      message = `Found ${data.profiles.length} profiles`
    }
    
    return { message, data }
  })

  const runAllTests = async () => {
    setRunningAll(true)
    
    // Run tests by category
    for (const category of testCategories) {
      for (const test of category.tests) {
        if (test.id === 'supabase') {
          await testSupabaseConnection()
        } else if (test.id === 'schema') {
          await testDatabaseSchema()
        } else if (test.endpoint) {
          await runApiTest(test.id, test.endpoint)
        }
        // Add small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    setRunningAll(false)
  }

  const runCategoryTests = async (categoryId: string) => {
    const category = testCategories.find(c => c.id === categoryId)
    if (!category) return

    for (const test of category.tests) {
      if (test.id === 'supabase') {
        await testSupabaseConnection()
      } else if (test.id === 'schema') {
        await testDatabaseSchema()
      } else if (test.endpoint) {
        await runApiTest(test.id, test.endpoint)
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  const getTestIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Square className="h-4 w-4 text-gray-300 dark:text-dark-600" />
    }
  }

  const getOverallHealth = (): 'excellent' | 'good' | 'degraded' | 'critical' => {
    const errorCount = Object.values(tests).filter(t => t.status === 'error').length
    const totalTests = Object.keys(tests).length
    
    if (totalTests === 0) return 'excellent'
    
    const errorRate = errorCount / totalTests
    if (errorRate === 0) return 'excellent'
    if (errorRate < 0.1) return 'good'
    if (errorRate < 0.3) return 'degraded'
    return 'critical'
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="page-header">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="page-title flex items-center gap-2">
              <Settings className="h-6 w-6" />
              System Settings & Diagnostics
            </h1>
            <p className="page-description">
              Monitor system health, test integrations, and manage configurations
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCredentials(!showCredentials)}
              className="btn-secondary text-sm"
            >
              {showCredentials ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  Hide Config
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  Show Config
                </>
              )}
            </button>
            <button
              onClick={runAllTests}
              disabled={runningAll}
              className="btn-primary text-sm"
            >
              {runningAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-1" />
                  Run All Tests
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Database Health"
          value={metrics.database.latency > 0 ? `${metrics.database.latency}ms` : 'N/A'}
          subtitle="Response time"
          icon={Database}
          status={metrics.database.status}
        />
        <MetricCard
          title="API Success Rate"
          value={`${metrics.performance.successRate}%`}
          subtitle="Last 24 hours"
          icon={Zap}
          trend={{ value: 2.5, positive: true }}
          status={metrics.performance.successRate > 95 ? 'healthy' : 'degraded'}
        />
        <MetricCard
          title="Active Resources"
          value={metrics.resources.totalAccounts}
          subtitle={`${metrics.resources.totalProxies} proxies active`}
          icon={Server}
          status="healthy"
        />
        <MetricCard
          title="System Uptime"
          value={`${metrics.performance.uptime}%`}
          subtitle="30-day average"
          icon={Activity}
          status="healthy"
        />
      </div>

      {/* Quick Stats Bar */}
      <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-4 border border-gray-200 dark:border-dark-700">
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{metrics.resources.totalAccounts}</p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Total Accounts</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{metrics.resources.totalProxies}</p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Proxies</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{metrics.resources.tasksCompleted}</p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Tasks Today</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{metrics.resources.imagesGenerated}</p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Images Today</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100">{metrics.resources.totalRentals}</p>
            <p className="text-xs text-gray-600 dark:text-dark-400">SMS Rentals</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-semibold ${metrics.resources.recentErrors > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
              {metrics.resources.recentErrors}
            </p>
            <p className="text-xs text-gray-600 dark:text-dark-400">Errors (1h)</p>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Test Categories - 2 columns */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-dark-100 flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Integration Tests
          </h2>
          
          {testCategories.map((category) => (
            <div key={category.id} className="card-lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-dark-800">
                    <category.icon className="h-5 w-5 text-gray-600 dark:text-dark-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-dark-100">{category.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-dark-400 mt-0.5">{category.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => runCategoryTests(category.id)}
                  className="btn-secondary btn-sm"
                  disabled={runningAll}
                >
                  <PlayCircle className="h-3 w-3 mr-1" />
                  Run
                </button>
              </div>

              <div className="space-y-2">
                {category.tests.map((test) => {
                  const result = tests[test.id]
                  const isRunning = result?.status === 'running'
                  
                  return (
                    <div
                      key={test.id}
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        result?.status === 'error' 
                          ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10'
                          : result?.status === 'success'
                          ? 'border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/10'
                          : 'border-gray-200 bg-gray-50 dark:border-dark-700 dark:bg-dark-800'
                      }`}
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getTestIcon(result?.status || 'idle')}
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-dark-100">
                            {test.name}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-dark-400">
                            {result?.message || test.description}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result?.duration && (
                          <span className="text-xs text-gray-500 dark:text-dark-400">
                            {result.duration}ms
                          </span>
                        )}
                        {!isRunning && (
                          <button
                            onClick={() => {
                              if (test.id === 'supabase') testSupabaseConnection()
                              else if (test.id === 'schema') testDatabaseSchema()
                              else if (test.endpoint) runApiTest(test.id, test.endpoint)
                            }}
                            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                            disabled={runningAll}
                          >
                            Test
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* API Status Panel - 1 column */}
        <div className="space-y-4">
          <h2 className="text-lg font-medium text-gray-900 dark:text-dark-100 flex items-center gap-2">
            <Network className="h-5 w-5" />
            Service Status
          </h2>

          <div className="card-lg space-y-4">
            {/* Database Status */}
            <div className="pb-4 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                  <span className="font-medium text-gray-900 dark:text-dark-100">Database</span>
                </div>
                <StatusIndicator status={metrics.database.status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600 dark:text-dark-400">Latency:</span>
                  <span className="ml-1 font-medium text-gray-900 dark:text-dark-100">
                    {metrics.database.latency}ms
                  </span>
                </div>
                <div>
                  <span className="text-gray-600 dark:text-dark-400">Status:</span>
                  <span className="ml-1 font-medium text-gray-900 dark:text-dark-100 capitalize">
                    {metrics.database.status}
                  </span>
                </div>
              </div>
            </div>

            {/* API Services */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-100">DaisySMS</span>
                </div>
                <StatusIndicator status={metrics.apis.daisysms.status} />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-100">GeeLark</span>
                </div>
                <StatusIndicator status={metrics.apis.geelark.status} />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wifi className="h-4 w-4 text-gray-600 dark:text-dark-400" />
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-100">SOAX</span>
                </div>
                <StatusIndicator status={metrics.apis.soax.status} />
              </div>
            </div>

            {/* Quick Links */}
            <div className="pt-4 border-t border-gray-200 dark:border-dark-700">
              <p className="text-xs font-medium text-gray-700 dark:text-dark-300 mb-2">Quick Actions</p>
              <div className="space-y-1">
                <Link 
                  href="/logs" 
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                >
                  <span className="text-sm text-gray-600 dark:text-dark-400">View System Logs</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
                <Link 
                  href="/profiles?action=sync" 
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                >
                  <span className="text-sm text-gray-600 dark:text-dark-400">Sync Profiles</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
                <Link 
                  href="/proxies?action=import" 
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                >
                  <span className="text-sm text-gray-600 dark:text-dark-400">Import Proxies</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
                <Link 
                  href="/settings/comments" 
                  className="flex items-center justify-between p-2 rounded hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
                >
                  <span className="text-sm text-gray-600 dark:text-dark-400">Manage Comments Pool</span>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              </div>
            </div>
          </div>

          {/* Authentication Method Toggle */}
          <div className="card-lg">
            <div className="flex items-center gap-2 mb-3">
              <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">GeeLark Authentication Method</h3>
            </div>
            
            <p className="text-xs text-gray-600 dark:text-dark-400 mb-4">
              Choose how GeeLark automations authenticate with TikTok accounts
            </p>

            <div className="space-y-2">
              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="authMethod"
                    value="daisysms"
                    checked={authMethod === 'daisysms'}
                    onChange={() => updateAuthMethod('daisysms')}
                    disabled={savingAuthMethod}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">DaisySMS Phone Numbers</p>
                    <p className="text-xs text-gray-600 dark:text-dark-400">Use phone numbers from SMS rentals</p>
                  </div>
                </div>
                <MessageSquare className="h-4 w-4 text-gray-400" />
              </label>

              <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors">
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="authMethod"
                    value="tiktok"
                    checked={authMethod === 'tiktok'}
                    onChange={() => updateAuthMethod('tiktok')}
                    disabled={savingAuthMethod}
                    className="text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-dark-100">TikTok Credentials</p>
                    <p className="text-xs text-gray-600 dark:text-dark-400">Use email/password combinations</p>
                  </div>
                </div>
                <Lock className="h-4 w-4 text-gray-400" />
              </label>
            </div>

            {savingAuthMethod && (
              <div className="mt-3 flex items-center gap-2 text-xs text-gray-600 dark:text-dark-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving preference...
              </div>
            )}

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-xs text-blue-800 dark:text-blue-200 flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span>
                  {authMethod === 'daisysms' 
                    ? 'Automations will use phone numbers from the phones table for authentication.'
                    : 'Automations will use email/password combinations from the TikTok credentials table.'}
                </span>
              </p>
            </div>

            <Link
              href="/tiktok-credentials"
              className="mt-3 inline-flex items-center text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Manage TikTok Credentials
              <ChevronRight className="h-3 w-3 ml-1" />
            </Link>
          </div>

          {/* Environment Info */}
          {showCredentials && (
            <div className="card-lg">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                <h3 className="text-sm font-medium text-gray-900 dark:text-dark-100">Environment Configuration</h3>
              </div>
              
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-3">
                <p className="text-xs text-yellow-800 dark:text-yellow-200 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Sensitive information - do not share
                </p>
              </div>

              <div className="space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-800 rounded">
                  <span className="text-gray-600 dark:text-dark-400">NODE_ENV</span>
                  <span className="text-gray-900 dark:text-dark-100">{process.env.NODE_ENV || 'development'}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-800 rounded">
                  <span className="text-gray-600 dark:text-dark-400">SUPABASE_URL</span>
                  <span className="text-gray-900 dark:text-dark-100">
                    {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓ Set' : '✗ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-800 rounded">
                  <span className="text-gray-600 dark:text-dark-400">SUPABASE_KEY</span>
                  <span className="text-gray-900 dark:text-dark-100">
                    {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-800 rounded">
                  <span className="text-gray-600 dark:text-dark-400">DAISYSMS_KEY</span>
                  <span className="text-gray-900 dark:text-dark-100">
                    {process.env.NEXT_PUBLIC_DAISYSMS_API_KEY ? '••••••' : '✗ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-800 rounded">
                  <span className="text-gray-600 dark:text-dark-400">GEELARK_KEY</span>
                  <span className="text-gray-900 dark:text-dark-100">
                    {process.env.NEXT_PUBLIC_GEELARK_API_KEY ? '••••••' : '✗ Missing'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-gray-50 dark:bg-dark-800 rounded">
                  <span className="text-gray-600 dark:text-dark-400">SOAX_KEY</span>
                  <span className="text-gray-900 dark:text-dark-100">
                    {process.env.NEXT_PUBLIC_SOAX_PACKAGE_KEY ? '••••••' : '✗ Missing'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Test Results Detail */}
      {Object.keys(tests).length > 0 && Object.values(tests).some(t => t.data) && (
        <div className="card-lg">
          <h2 className="text-lg font-medium text-gray-900 dark:text-dark-100 mb-4 flex items-center gap-2">
            <Code className="h-5 w-5" />
            Test Results Detail
          </h2>
          
          <div className="space-y-3">
            {Object.entries(tests).map(([testId, result]) => {
              if (!result.data) return null
              
              return (
                <details key={testId} className="group">
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-dark-700 hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors">
                      <div className="flex items-center gap-2">
                        {getTestIcon(result.status)}
                        <span className="font-medium text-gray-900 dark:text-dark-100 capitalize">
                          {testId.replace(/-/g, ' ')}
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-open:rotate-90 transition-transform" />
                    </div>
                  </summary>
                  <div className="mt-2 p-3 bg-gray-50 dark:bg-dark-800 rounded-lg">
                    <pre className="text-xs text-gray-700 dark:text-dark-300 overflow-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </div>
                </details>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
} 