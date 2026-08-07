import type { Metadata, Viewport } from 'next'
import { CartProvider } from './lib/cartStore'
import { BgmProvider } from './lib/BgmContext'
import { VideoPlayerProvider } from './lib/VideoPlayerContext'
import { CouponProvider } from './lib/CouponContext'
import { MemberStateProvider } from './lib/MemberStateContext'
import { MessageProvider } from './lib/MessageContext'
import GlobalActionFab from './lib/GlobalActionFab'
import PWAPrompt from './lib/PWAPrompt'
import InAppBanner from './lib/InAppBanner'
import SWRegister from './lib/SWRegister'
import OrderWatcher from './lib/OrderWatcher'
import OrderSessionBell from './lib/OrderSessionBell'
import TableSessionJoinPrompt from './lib/TableSessionJoinPrompt'
import VersionWatcher from './lib/VersionWatcher'
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
         <MemberStateProvider>
          <BgmProvider>
           <CouponProvider>
            <MessageProvider>
             <VideoPlayerProvider>
             {children}
             <GlobalActionFab />
             <InAppBanner />
             <PWAPrompt />
             <SWRegister />
             <OrderWatcher />
             <OrderSessionBell />
             <TableSessionJoinPrompt />
             <VersionWatcher />
             </VideoPlayerProvider>
            </MessageProvider>
           </CouponProvider>
          </BgmProvider>
         </MemberStateProvider>
        </CartProvider>
      </body>
    </html>
  )
}
