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
  Camera,
  ListChecks,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useSidebar } from '@/lib/context/sidebar-context'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Profiles', href: '/profiles', icon: Users },
  { name: 'Tasks', href: '/tasks', icon: ListChecks },
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
  const { isCollapsed, setIsCollapsed } = useSidebar()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div className={cn(
      "fixed inset-y-0 left-0 z-50 bg-white border-r border-gray-200 dark:bg-dark-850 dark:border-dark-700 transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center px-6 relative">
          <Link href="/" className={cn(
            "flex items-center gap-3 hover:opacity-80 transition-all duration-300",
            isCollapsed && "justify-center"
          )}>
            <Image
              src="/spectre.png"
              alt="Spectre"
              width={32}
              height={32}
              className="rounded-lg flex-shrink-0"
            />
            <h1 className={cn(
              "text-xl brand-title text-gray-900 dark:text-dark-100 transition-all duration-300",
              isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            )}>SPECTRE</h1>
          </Link>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className={cn(
              "absolute -right-3 top-1/2 -translate-y-1/2 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-full p-1 hover:bg-gray-50 dark:hover:bg-dark-700 transition-all duration-300",
              isCollapsed && "rotate-180"
            )}
          >
            <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-dark-300" />
          </button>
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
                  'group flex items-center px-3 py-2 text-sm transition-all duration-300 rounded-md body-text relative',
                  isActive
                    ? 'bg-gray-100 text-gray-900 font-medium dark:bg-dark-700 dark:text-dark-100'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-dark-300 dark:hover:bg-dark-800 dark:hover:text-dark-100',
                  isCollapsed && "justify-center"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon
                  className={cn(
                    'h-5 w-5 flex-shrink-0 transition-all duration-300',
                    isActive
                      ? 'text-gray-900 dark:text-dark-100'
                      : 'text-gray-400 group-hover:text-gray-600 dark:text-dark-500 dark:group-hover:text-dark-300',
                    !isCollapsed && 'mr-3'
                  )}
                />
                <span className={cn(
                  "transition-all duration-300",
                  isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                )}>
                  {item.name}
                </span>
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                    {item.name}
                  </div>
                )}
              </Link>
            )
          })}
        </nav>
        
        <div className="border-t border-gray-200 dark:border-dark-700 p-3">
          <button
            onClick={handleSignOut}
            className={cn(
              "group flex w-full items-center px-3 py-2 text-sm font-medium text-gray-600 rounded-md hover:bg-gray-50 hover:text-gray-900 dark:text-dark-300 dark:hover:bg-dark-800 dark:hover:text-dark-100 transition-all duration-300 relative",
              isCollapsed && "justify-center"
            )}
            title={isCollapsed ? "Sign out" : undefined}
          >
            <LogOut className={cn(
              "h-5 w-5 text-gray-400 group-hover:text-gray-600 dark:text-dark-500 dark:group-hover:text-dark-300 flex-shrink-0 transition-all duration-300",
              !isCollapsed && "mr-3"
            )} />
            <span className={cn(
              "transition-all duration-300",
              isCollapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            )}>
              Sign out
            </span>
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-dark-700 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                Sign out
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}