import type { Metadata, Viewport } from 'next'
import VersionWatcher from './lib/VersionWatcher'
import OwnerAuthGuard from './lib/OwnerAuthGuard'
import BackExitGuard from './lib/BackExitGuard'
import './globals.css'

export const metadata: Metadata = {
  title: '또봉이통닭 백운역점 — 점주',
  description: '주문 관리 대시보드',
}
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0d0d0d',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}<VersionWatcher /><OwnerAuthGuard /><BackExitGuard title="점주 화면을 나가시겠어요?" sub="화면을 닫으면 새 주문 알림을 놓칠 수 있어요." /></body>
    </html>
  )
}
