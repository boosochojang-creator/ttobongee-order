import type { Metadata, Viewport } from 'next'
import { CartProvider } from './lib/cartStore'
import { BgmProvider } from './lib/BgmContext'
import GlobalCallButton from './lib/GlobalCallButton'
import GlobalBgmButton from './lib/GlobalBgmButton'
import PWAPrompt from './lib/PWAPrompt'
import SWRegister from './lib/SWRegister'
import './globals.css'

export const metadata: Metadata = {
  title: '또봉이통닭 백운역점',
  description: 'QR 모바일 주문',
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#111111',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="또봉이통닭" />
      </head>
      <body>
        <CartProvider>
          <BgmProvider>
            {children}
            <GlobalCallButton />
            <GlobalBgmButton />
            <PWAPrompt />
            <SWRegister />
          </BgmProvider>
        </CartProvider>
      </body>
    </html>
  )
}
