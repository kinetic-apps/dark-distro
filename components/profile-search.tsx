'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'

export function ProfileSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get('search') || '')
  const [isSearching, setIsSearching] = useState(false)

  // Debounced search function
  const performSearch = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value) {
      params.set('search', value)
    } else {
      params.delete('search')
    }
    
    router.push(`/profiles?${params.toString()}`)
    setIsSearching(false)
  }, [router, searchParams])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== searchParams.get('search')) {
        performSearch(searchValue)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchValue, performSearch, searchParams])

  const handleClear = () => {
    setSearchValue('')
    performSearch('')
  }

  return (
    <div className="relative flex-1 max-w-md">
      <div className="relative">
        <Search className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors ${
          isSearching ? 'text-blue-500 animate-pulse' : 'text-gray-400'
        }`} />
        <input
          type="search"
          placeholder="Search profiles by username..."
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value)
            setIsSearching(true)
          }}
          className="input pl-10 pr-10 w-full"
        />
        {searchValue && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
} 