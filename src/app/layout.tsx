import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { SerwistProvider } from './serwist-provider'
import './globals.css'

const geist = Geist({
  variable: '--font-geist',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Les Jardins de la Sauge',
  description: 'Traçabilité de la graine au produit fini',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LJS',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#3A5A40',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${geist.variable} antialiased`}>
        <SerwistProvider swUrl="/serwist/sw.js">{children}</SerwistProvider>
      </body>
    </html>
  )
}
