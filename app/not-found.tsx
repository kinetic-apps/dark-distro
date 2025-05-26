'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-dark-900 transition-colors">
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <Image
            src="/spectre.png"
            alt="Spectre"
            width={80}
            height={80}
            className="rounded-xl opacity-75"
          />
        </div>
        
        <h1 className="text-6xl font-bold text-gray-900 dark:text-dark-100 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-dark-200 mb-2">Page Not Found</h2>
        <p className="text-gray-600 dark:text-dark-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="btn-primary inline-flex items-center justify-center">
            <Home className="mr-2 h-4 w-4" />
            Go Home
          </Link>
          <button 
            onClick={() => window.history.back()} 
            className="btn-secondary inline-flex items-center justify-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  )
} 