import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/context/ThemeContext";
import ConditionalLayout from "@/components/ConditionalLayout";

export const metadata: Metadata = {
  title: "SPECTRE - Advanced Cloud Operations Control Center",
  description: "Advanced cloud phone management, proxy orchestration, and content distribution platform",
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
          <div className="min-h-screen bg-gray-50 dark:bg-dark-900 transition-colors duration-200">
            <ConditionalLayout>
              {children}
            </ConditionalLayout>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
