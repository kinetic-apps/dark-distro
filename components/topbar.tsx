'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatRelativeTime } from '@/lib/utils'
import { Activity, AlertCircle, CheckCircle, Users } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { useSidebar } from '@/lib/context/sidebar-context'
import { cn } from '@/lib/utils'

export function TopBar() {
  const [stats, setStats] = useState({
    activeProfiles: 0,
    activeTasks: 0,
    recentErrors: 0
  })
  const [lastSync, setLastSync] = useState(new Date())
  const { isCollapsed } = useSidebar()

  useEffect(() => {
    const supabase = createClient()
    
    const fetchStats = async () => {
      const [profiles, tasks, errors] = await Promise.all([
        supabase
          .from('accounts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active'),
        supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'running'),
        supabase
          .from('logs')
          .select('*', { count: 'exact', head: true })
          .in('level', ['error', 'critical'])
          .gte('timestamp', new Date(Date.now() - 3600000).toISOString())
      ])

      setStats({
        activeProfiles: profiles.count || 0,
        activeTasks: tasks.count || 0,
        recentErrors: errors.count || 0
      })
      setLastSync(new Date())
    }

    fetchStats()
    const interval = setInterval(fetchStats, 10000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={cn(
      "fixed top-0 right-0 z-40 bg-white border-b border-gray-200 dark:bg-dark-850 dark:border-dark-700 transition-all duration-300 ease-in-out",
      isCollapsed ? "left-16" : "left-64"
    )}>
      <div className="h-16 px-6 flex items-center">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center text-gray-600 dark:text-dark-300">
              <Users className="h-4 w-4 mr-1.5" />
              <span className="font-medium">{stats.activeProfiles}</span>
              <span className="ml-1">active</span>
            </div>
            
            <div className="flex items-center text-gray-600 dark:text-dark-300">
              <Activity className="h-4 w-4 mr-1.5" />
              <span className="font-medium">{stats.activeTasks}</span>
              <span className="ml-1">running</span>
            </div>
            
            <div className="flex items-center">
              {stats.recentErrors > 0 ? (
                <>
                  <AlertCircle className="h-4 w-4 mr-1.5 text-red-500" />
                  <span className="font-medium text-red-600 dark:text-red-400">{stats.recentErrors}</span>
                  <span className="ml-1 text-red-600 dark:text-red-400">errors</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-1.5 text-green-500" />
                  <span className="text-green-600 dark:text-green-400">No recent errors</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-400 dark:text-dark-500">
              Last sync: {formatRelativeTime(lastSync.toISOString())}
            </div>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </div>
  )
}