import type { Metadata, Viewport } from 'next'
import { CartProvider } from './lib/cartStore'
import { BgmProvider } from './lib/BgmContext'
import GlobalCallButton from './lib/GlobalCallButton'
import GlobalBgmButton from './lib/GlobalBgmButton'
// v1.4: PWA 설치 유도 배너 비활성화 (./lib/PWAPrompt.tsx 참조 — 구조 보존)
// import PWAPrompt from './lib/PWAPrompt'
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
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="또봉이통닭" />
      </head>
      <body>
        <CartProvider>
          <BgmProvider>
            {children}
            <GlobalCallButton />
            <GlobalBgmButton />
            {/* <PWAPrompt /> */}
          </BgmProvider>
        </CartProvider>
      </body>
    </html>
  )
}
