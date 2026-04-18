import type { Metadata, Viewport } from 'next'

export const metadata: Metadata = {
  title: '護理工作清單',
  description: 'Nursing Care Checklist App',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1A3C5E',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-TW">
      <body style={{ margin: 0, padding: 0, background: '#F0F4F8' }}>
        {children}
      </body>
    </html>
  )
}
