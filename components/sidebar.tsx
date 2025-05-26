'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { 
  Home, 
  Users, 
  Wifi, 
  MessageSquare, 
  Image as ImageIcon, 
  Send, 
  FileText,
  Settings,
  LogOut,
  Wand2,
  Camera
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Profiles', href: '/profiles', icon: Users },
  { name: 'Screenshots', href: '/screenshots', icon: Camera },
  { name: 'Proxies', href: '/proxies', icon: Wifi },
  { name: 'SMS', href: '/sms', icon: MessageSquare },
  { name: 'Assets', href: '/assets', icon: ImageIcon },
  { name: 'Image Gen', href: '/image-generator', icon: Wand2 },
  { name: 'Posts', href: '/posts', icon: Send },
  { name: 'Logs', href: '/logs', icon: FileText },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 dark:bg-dark-850 dark:border-dark-700 transition-colors duration-200">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center px-6">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <Image
              src="/spectre.png"
              alt="Spectre"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <h1 className="text-xl brand-title text-gray-900 dark:text-dark-100">SPECTRE</h1>
          </Link>
        </div>
        
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/' && pathname.startsWith(item.href))
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'group flex items-center px-3 py-2 text-sm transition-colors rounded-md body-text',
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-medium dark:bg-dark-700 dark:text-dark-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-dark-300 dark:hover:bg-dark-800 dark:hover:text-dark-100'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive
                      ? 'text-gray-900 dark:text-dark-100'
                      : 'text-gray-400 group-hover:text-gray-600 dark:text-dark-500 dark:group-hover:text-dark-300'
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="border-t border-gray-200 dark:border-dark-700 p-3">
          <button
            onClick={handleSignOut}
            className="group flex w-full items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 dark:text-dark-300 dark:hover:bg-dark-800 dark:hover:text-dark-100 transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:text-dark-500 dark:group-hover:text-dark-300" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}