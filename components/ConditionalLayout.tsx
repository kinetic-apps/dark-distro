'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";
import { SidebarProvider, useSidebar } from '@/lib/context/sidebar-context';
import { cn } from '@/lib/utils';

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

function LayoutContent({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth')
  const { isCollapsed } = useSidebar()

  if (isAuthPage) {
    // For auth pages, render children directly without sidebar/topbar
    return <>{children}</>
  }

  // For regular pages, render with sidebar and topbar
  return (
    <>
      <Sidebar />
      <TopBar />
      <main className={cn(
        "pt-16 transition-all duration-300 ease-in-out",
        isCollapsed ? "pl-16" : "pl-64"
      )}>
        <div className="p-6">
          {children}
        </div>
      </main>
    </>
  )
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  )
} 