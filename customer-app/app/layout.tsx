import type { Metadata, Viewport } from 'next'
import { CartProvider } from './lib/cartStore'
import { BgmProvider } from './lib/BgmContext'
import GlobalCallButton from './lib/GlobalCallButton'
import GlobalHubButton from './lib/GlobalHubButton'
import PWAReinstallButton from './lib/PWAReinstallButton'
import PWAPrompt from './lib/PWAPrompt'
import SWRegister from './lib/SWRegister'
import OrderWatcher from './lib/OrderWatcher'
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
            <GlobalHubButton />
            <PWAReinstallButton />
            <PWAPrompt />
            <SWRegister />
            <OrderWatcher />
          </BgmProvider>
        </CartProvider>
      </body>
    </html>
  )
}
