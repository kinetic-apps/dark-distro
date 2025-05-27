'use client'

import { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface ProfileStatsCardProps {
  title: string
  value: number | string
  subtitle?: string
  icon: ReactNode
  iconBgColor: string
  trend?: {
    value: number
    isPositive: boolean
  }
  onClick?: () => void
}

export function ProfileStatsCard({
  title,
  value,
  subtitle,
  icon,
  iconBgColor,
  trend,
  onClick
}: ProfileStatsCardProps) {
  return (
    <div 
      className={`card group hover:shadow-md transition-all duration-200 ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 dark:text-dark-400">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <p className="text-3xl font-semibold text-gray-900 dark:text-dark-100">
              {value}
            </p>
            {trend && (
              <span className={`flex items-center text-sm font-medium ${
                trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {trend.isPositive ? (
                  <TrendingUp className="h-4 w-4 mr-1" />
                ) : (
                  <TrendingDown className="h-4 w-4 mr-1" />
                )}
                {Math.abs(trend.value)}%
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-gray-500 dark:text-dark-500">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`rounded-lg p-3 ${iconBgColor} group-hover:scale-110 transition-transform duration-200`}>
          {icon}
        </div>
      </div>
    </div>
  )
} 