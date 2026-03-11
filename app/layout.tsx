import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { ServiceWorkerProvider } from '@/components/service-worker-provider'
import './globals.css'

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#e85d8a',
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Pillow 💊',
  description: 'Rappel pilule et suivi de cycle menstruel',
  generator: 'Next.js',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Pillow',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: '/pillow-logo.png',
    apple: '/pillow-logo.png',
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'Pillow',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning className={geist.variable}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#e85d8a" />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <ServiceWorkerProvider />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
