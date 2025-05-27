import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function ProfileDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="bg-white dark:bg-dark-850 border-b border-gray-200 dark:border-dark-700 -mx-6 -mt-6 px-6 py-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <Link 
              href="/profiles" 
              className="mt-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors dark:text-dark-500 dark:hover:text-dark-300 dark:hover:bg-dark-800"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-gray-200 dark:bg-dark-700 animate-pulse" />
              
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-8 w-48 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                  <div className="h-8 w-24 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
                </div>
                
                <div className="mt-2 flex items-center gap-4">
                  <div className="h-4 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                  <div className="h-4 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-10 w-10 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            <div className="h-10 w-10 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
          </div>
        </div>
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="h-4 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="mt-2 h-8 w-16 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="mt-1 h-3 w-20 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              </div>
              <div className="h-12 w-12 bg-gray-200 dark:bg-dark-700 rounded-lg animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content Skeleton */}
        <div className="lg:col-span-2 space-y-6">
          {/* Device & Connection Skeleton */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-700">
              <div className="h-6 w-40 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => (
                  <div key={i}>
                    <div className="h-5 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse mb-4" />
                    <div className="space-y-3">
                      {[...Array(4)].map((_, j) => (
                        <div key={j} className="flex items-center justify-between">
                          <div className="h-4 w-20 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                          <div className="h-4 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Posts Skeleton */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
              <div className="h-6 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
            </div>
            <div className="divide-y divide-gray-200 dark:divide-dark-700">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-4">
                  <div className="h-4 w-full bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                  <div className="mt-2 flex items-center gap-4">
                    <div className="h-3 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                    <div className="h-5 w-16 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar Skeleton */}
        <div className="space-y-6">
          {/* Quick Actions Skeleton */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
            <div className="h-6 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-10 w-full bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              ))}
            </div>
          </div>

          {/* Tasks Overview Skeleton */}
          <div className="bg-white dark:bg-dark-850 rounded-lg border border-gray-200 dark:border-dark-700 p-6">
            <div className="h-6 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse mb-4" />
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                  <div className="h-4 w-8 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 