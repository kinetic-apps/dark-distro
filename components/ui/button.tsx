import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

const buttonVariants = {
  variant: {
    default: "bg-gray-900 text-white hover:bg-gray-800 dark:bg-dark-100 dark:text-dark-900 dark:hover:bg-dark-200",
    destructive:
      "bg-red-500 text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700",
    outline:
      "border border-gray-300 bg-transparent hover:bg-gray-100 dark:border-dark-700 dark:hover:bg-dark-800",
    secondary:
      "bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-dark-800 dark:text-dark-100 dark:hover:bg-dark-700",
    ghost: "hover:bg-gray-100 dark:hover:bg-dark-800",
    link: "text-gray-900 dark:text-dark-100 underline-offset-4 hover:underline",
  },
  size: {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10",
  },
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900 disabled:pointer-events-none disabled:opacity-50",
          buttonVariants.variant[variant],
          buttonVariants.size[size],
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }