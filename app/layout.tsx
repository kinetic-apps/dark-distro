import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import { NotificationProvider } from "@/lib/context/notification-context";
import ConditionalLayout from "@/components/ConditionalLayout";

export const metadata: Metadata = {
  title: "SPECTRE - Advanced Cloud Operations Control Center",
  description: "Advanced cloud phone management, proxy orchestration, and content distribution platform",
  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
      {
        url: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        url: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      }
    ],
    apple: [
      {
        url: '/spectre.png',
        sizes: '180x180',
        type: 'image/png',
      }
    ],
    shortcut: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>
          <NotificationProvider>
            <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
              <ConditionalLayout>
                {children}
              </ConditionalLayout>
            </div>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
