'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Home, 
  Users, 
  Wifi, 
  MessageSquare, 
  Image, 
  Send, 
  FileText,
  Settings,
  LogOut 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Profiles', href: '/profiles', icon: Users },
  { name: 'Proxies', href: '/proxies', icon: Wifi },
  { name: 'SMS', href: '/sms', icon: MessageSquare },
  { name: 'Assets', href: '/assets', icon: Image },
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
    <div className="fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-semibold text-gray-900">Dark Distro</h1>
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
                  'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )}
              >
                <item.icon
                  className={cn(
                    'mr-3 h-5 w-5 flex-shrink-0',
                    isActive
                      ? 'text-gray-900'
                      : 'text-gray-400 group-hover:text-gray-600'
                  )}
                />
                {item.name}
              </Link>
            )
          })}
        </nav>
        
        <div className="border-t border-gray-200 p-3">
          <button
            onClick={handleSignOut}
            className="group flex w-full items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-600" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}