import { Loader2 } from 'lucide-react'

export default function ProfilesLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
          <div className="mt-2 h-4 w-64 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-10 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
          <div className="h-10 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
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

      {/* Filters Skeleton */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 max-w-md h-10 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
        <div className="flex gap-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 w-24 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
          ))}
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="overflow-hidden bg-white border border-gray-200 rounded-lg dark:bg-dark-850 dark:border-dark-700">
        <div className="bg-gray-50 dark:bg-dark-800 px-6 py-3">
          <div className="flex items-center gap-4">
            <div className="h-4 w-4 bg-gray-300 dark:bg-dark-600 rounded animate-pulse" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-4 w-20 bg-gray-300 dark:bg-dark-600 rounded animate-pulse" />
            ))}
          </div>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-dark-700">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-4 flex items-center gap-4">
              <div className="h-4 w-4 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="flex items-center gap-3 flex-1">
                <div className="h-10 w-10 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                  <div className="h-3 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                </div>
              </div>
              <div className="h-6 w-20 bg-gray-200 dark:bg-dark-700 rounded-full animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="h-4 w-24 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="h-4 w-20 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              <div className="flex gap-2">
                <div className="h-8 w-8 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
                <div className="h-8 w-8 bg-gray-200 dark:bg-dark-700 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Loading Overlay */}
      <div className="fixed inset-0 bg-white/50 dark:bg-dark-900/50 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-gray-600 dark:text-dark-400" />
          <p className="text-sm font-medium text-gray-600 dark:text-dark-400">Loading profiles...</p>
        </div>
      </div>
    </div>
  )
} 