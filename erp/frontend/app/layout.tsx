import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { ThemeProvider } from './ThemeContext'
import { Providers } from './Providers'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ChriDirect ERP',
  description: 'Plateforme de gestion des commandes, clients et livraisons ChriDirect',
  generator: 'ChriDirect',
  icons: {
    icon: '/icon.png',
    apple: '/icon.png',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-200">
        <Providers>
          <ThemeProvider>
            <div className="relative min-h-screen">
              <main className="relative z-10">{children}</main>
            </div>
          </ThemeProvider>
        </Providers>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
