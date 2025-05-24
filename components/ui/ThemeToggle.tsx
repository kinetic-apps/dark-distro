'use client'

import React from 'react'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/context/ThemeContext'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent bg-gray-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-dark-700 dark:focus:ring-dark-400"
      role="switch"
      aria-checked={theme === 'dark'}
      aria-label="Toggle dark mode"
    >
      <span
        className={`${
          theme === 'dark' ? 'translate-x-6' : 'translate-x-1'
        } inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out shadow-lg dark:bg-dark-100`}
      />
      <span
        className={`${
          theme === 'dark' ? 'opacity-100' : 'opacity-0'
        } absolute left-1 top-1/2 -translate-y-1/2 transition-opacity duration-200`}
      >
        <Moon className="h-3 w-3 text-dark-400" />
      </span>
      <span
        className={`${
          theme === 'light' ? 'opacity-100' : 'opacity-0'
        } absolute right-1 top-1/2 -translate-y-1/2 transition-opacity duration-200`}
      >
        <Sun className="h-3 w-3 text-yellow-500" />
      </span>
    </button>
  )
}

export default ThemeToggle 