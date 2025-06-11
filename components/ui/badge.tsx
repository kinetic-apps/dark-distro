import * as React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

const badgeVariants = {
  default:
    "bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900",
  secondary:
    "bg-gray-100 text-gray-700 dark:bg-dark-800 dark:text-dark-300",
  destructive:
    "bg-red-500 text-white dark:bg-red-600",
  outline:
    "text-gray-700 dark:text-dark-300 border border-gray-300 dark:border-dark-700",
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          badgeVariants[variant],
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }