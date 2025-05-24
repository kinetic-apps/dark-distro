'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from "@/components/sidebar";
import { TopBar } from "@/components/topbar";

interface ConditionalLayoutProps {
  children: React.ReactNode;
}

export default function ConditionalLayout({ children }: ConditionalLayoutProps) {
  const pathname = usePathname()
  const isAuthPage = pathname.startsWith('/auth')

  if (isAuthPage) {
    // For auth pages, render children directly without sidebar/topbar
    return <>{children}</>
  }

  // For regular pages, render with sidebar and topbar
  return (
    <>
      <Sidebar />
      <TopBar />
      <main className="pl-64 pt-16">
        <div className="p-6">
          {children}
        </div>
      </main>
    </>
  )
} 