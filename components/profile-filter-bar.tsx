'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronRight, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FilterOption {
  id: string
  type: 'tag' | 'ready' | 'activity' | 'warmup'
  label: string
  value: string | boolean
  count?: number
}

interface ProfileFilterBarProps {
  profiles: any[]
  selectedFilters: string[]
  onFilterChange: (filterIds: string[]) => void
  onProfilesSelect: (profileIds: string[]) => void
  onProfilesFilter: (filteredProfiles: any[]) => void
}

export function ProfileFilterBar({ 
  profiles, 
  selectedFilters, 
  onFilterChange,
  onProfilesSelect,
  onProfilesFilter
}: ProfileFilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([])
  const [showLeftGradient, setShowLeftGradient] = useState(false)
  const [showRightGradient, setShowRightGradient] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Build filter options from profiles data
  useEffect(() => {
    const options: FilterOption[] = []
    
    // Extract unique tags with counts
    const tagCounts = new Map<string, number>()
    profiles.forEach(profile => {
      if (profile.phone?.tags) {
        profile.phone.tags.forEach((tag: string) => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
        })
      }
    })
    
    // Add tag filters
    Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .forEach(([tag, count]) => {
        options.push({
          id: `tag-${tag}`,
          type: 'tag',
          label: tag,
          value: tag,
          count
        })
      })
    
    // Add ready status filters
    const readyCount = profiles.filter(p => p.ready_for_actions).length
    const notReadyCount = profiles.length - readyCount
    
    if (readyCount > 0) {
      options.push({
        id: 'ready-true',
        type: 'ready',
        label: 'Ready for Actions',
        value: true,
        count: readyCount
      })
    }
    
    if (notReadyCount > 0) {
      options.push({
        id: 'ready-false',
        type: 'ready',
        label: 'Not Ready',
        value: false,
        count: notReadyCount
      })
    }
    
    // Add activity filters
    const now = new Date()
    const activeProfiles = profiles.filter(profile => {
      if (!profile.tasks || profile.tasks.length === 0) return false
      
      const latestTask = profile.tasks
        .filter((task: any) => task.completed_at || task.started_at)
        .sort((a: any, b: any) => {
          const aTime = new Date(a.completed_at || a.started_at || 0).getTime()
          const bTime = new Date(b.completed_at || b.started_at || 0).getTime()
          return bTime - aTime
        })[0]
      
      if (!latestTask) return false
      
      const taskTime = new Date(latestTask.completed_at || latestTask.started_at || 0)
      const hoursDiff = (now.getTime() - taskTime.getTime()) / (1000 * 60 * 60)
      
      return hoursDiff <= 24 // Active in last 24 hours
    })
    
    const inactiveCount = profiles.length - activeProfiles.length
    
    if (activeProfiles.length > 0) {
      options.push({
        id: 'activity-active',
        type: 'activity',
        label: 'Active (24h)',
        value: 'active',
        count: activeProfiles.length
      })
    }
    
    if (inactiveCount > 0) {
      options.push({
        id: 'activity-inactive',
        type: 'activity',
        label: 'Inactive',
        value: 'inactive',
        count: inactiveCount
      })
    }
    
    // Add warmup status filters
    const warmedUpProfiles = profiles.filter(p => 
      p.total_warmup_duration_minutes && p.total_warmup_duration_minutes >= 60
    )
    const notWarmedUpProfiles = profiles.filter(p => 
      !p.total_warmup_duration_minutes || p.total_warmup_duration_minutes < 60
    )
    
    if (warmedUpProfiles.length > 0) {
      options.push({
        id: 'warmup-completed',
        type: 'warmup',
        label: 'Warmed Up',
        value: 'completed',
        count: warmedUpProfiles.length
      })
    }
    
    if (notWarmedUpProfiles.length > 0) {
      options.push({
        id: 'warmup-pending',
        type: 'warmup',
        label: 'Not Warmed Up',
        value: 'pending',
        count: notWarmedUpProfiles.length
      })
    }
    
    setFilterOptions(options)
  }, [profiles])

  // Apply filters and select matching profiles
  useEffect(() => {
    if (selectedFilters.length === 0) {
      onProfilesSelect([])
      onProfilesFilter(profiles) // Show all profiles when no filters
      return
    }
    
    const matchingProfiles = profiles.filter(profile => {
      // Check each selected filter
      return selectedFilters.every(filterId => {
        const filter = filterOptions.find(f => f.id === filterId)
        if (!filter) return true
        
        switch (filter.type) {
          case 'tag':
            return profile.phone?.tags?.includes(filter.value as string)
          
          case 'ready':
            return profile.ready_for_actions === filter.value
          
          case 'activity':
            if (!profile.tasks || profile.tasks.length === 0) {
              return filter.value === 'inactive'
            }
            
            const now = new Date()
            const latestTask = profile.tasks
              .filter((task: any) => task.completed_at || task.started_at)
              .sort((a: any, b: any) => {
                const aTime = new Date(a.completed_at || a.started_at || 0).getTime()
                const bTime = new Date(b.completed_at || b.started_at || 0).getTime()
                return bTime - aTime
              })[0]
            
            if (!latestTask) return filter.value === 'inactive'
            
            const taskTime = new Date(latestTask.completed_at || latestTask.started_at || 0)
            const hoursDiff = (now.getTime() - taskTime.getTime()) / (1000 * 60 * 60)
            
            if (filter.value === 'active') {
              return hoursDiff <= 24
            } else {
              return hoursDiff > 24
            }
          
          case 'warmup':
            const warmupMinutes = profile.total_warmup_duration_minutes || 0
            if (filter.value === 'completed') {
              return warmupMinutes >= 60
            } else {
              return warmupMinutes < 60
            }
          
          default:
            return true
        }
      })
    })
    
    onProfilesSelect(matchingProfiles.map(p => p.id))
    onProfilesFilter(matchingProfiles)
  }, [selectedFilters, filterOptions, profiles, onProfilesSelect, onProfilesFilter])

  // Check scroll position to show/hide gradients
  useEffect(() => {
    const checkScroll = () => {
      if (!scrollContainerRef.current) return
      
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setShowLeftGradient(scrollLeft > 0)
      setShowRightGradient(scrollLeft < scrollWidth - clientWidth - 5)
    }

    const container = scrollContainerRef.current
    if (container && isExpanded) {
      checkScroll() // Initial check
      container.addEventListener('scroll', checkScroll)
      window.addEventListener('resize', checkScroll)
      
      // Check after a small delay to ensure layout is complete
      setTimeout(checkScroll, 100)
    }

    return () => {
      if (container) {
        container.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
  }, [isExpanded, filterOptions])

  const toggleFilter = (filterId: string) => {
    if (selectedFilters.includes(filterId)) {
      onFilterChange(selectedFilters.filter(id => id !== filterId))
    } else {
      onFilterChange([...selectedFilters, filterId])
    }
  }

  const clearAllFilters = () => {
    onFilterChange([])
  }

  const getFilterColor = (type: string) => {
    switch (type) {
      case 'tag':
        return 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400'
      case 'ready':
        return 'bg-green-500/10 hover:bg-green-500/20 text-green-600 dark:text-green-400'
      case 'activity':
        return 'bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400'
      case 'warmup':
        return 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600 dark:text-orange-400'
      default:
        return 'bg-gray-500/10 hover:bg-gray-500/20'
    }
  }

  return (
    <div className="flex items-center gap-2 h-10">
      {/* Filter Button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(!isExpanded)}
        className="shrink-0 h-9"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0" />
        )}
        <span className="ml-1">Filters</span>
        {selectedFilters.length > 0 && (
          <Badge variant="secondary" className="ml-2">
            {selectedFilters.length}
          </Badge>
        )}
      </Button>

      {/* Expanded filters container - with consistent height */}
      <div className={cn(
        "flex items-center gap-2 flex-1 transition-opacity duration-200",
        isExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
      )}>
        {/* Filters scroll container with proper padding for outlines */}
        <div className="relative flex-1">
          <div 
            ref={scrollContainerRef}
            className="flex gap-2 overflow-x-auto py-0.5 px-1 filter-scrollbar"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin'
            }}
          >
            {filterOptions.map(filter => (
              <Button
                key={filter.id}
                variant="ghost"
                size="sm"
                onClick={() => toggleFilter(filter.id)}
                className={cn(
                  "shrink-0 transition-all whitespace-nowrap relative h-9",
                  selectedFilters.includes(filter.id)
                    ? cn(getFilterColor(filter.type), "ring-2 ring-blue-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900")
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                )}
              >
                <span>{filter.label}</span>
                {filter.count !== undefined && (
                  <Badge 
                    variant="secondary" 
                    className="ml-2 h-5 px-1.5 text-xs"
                  >
                    {filter.count}
                  </Badge>
                )}
              </Button>
            ))}
            
            {/* Clear button - inline with filter options */}
            {selectedFilters.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAllFilters}
                className="shrink-0 text-muted-foreground hover:text-foreground ml-2 h-9"
              >
                <X className="h-4 w-4" />
                <span className="ml-1">Clear</span>
              </Button>
            )}
          </div>
          
          {/* Scroll indicators */}
          <div className={cn(
            "absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white via-white/80 dark:from-dark-900 dark:via-dark-900/80 to-transparent pointer-events-none transition-opacity duration-200",
            showLeftGradient ? "opacity-100" : "opacity-0"
          )} />
          <div className={cn(
            "absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white via-white/80 dark:from-dark-900 dark:via-dark-900/80 to-transparent pointer-events-none transition-opacity duration-200",
            showRightGradient ? "opacity-100" : "opacity-0"
          )} />
        </div>
      </div>

      {/* Selected filters summary - show when collapsed */}
      {selectedFilters.length > 0 && !isExpanded && (
        <div className="flex gap-1 items-center">
          {selectedFilters.slice(0, 2).map(filterId => {
            const filter = filterOptions.find(f => f.id === filterId)
            if (!filter) return null
            return (
              <Badge
                key={filterId}
                variant="secondary"
                className={cn("text-xs", getFilterColor(filter.type))}
              >
                {filter.label}
              </Badge>
            )
          })}
          {selectedFilters.length > 2 && (
            <Badge variant="secondary" className="text-xs">
              +{selectedFilters.length - 2} more
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}