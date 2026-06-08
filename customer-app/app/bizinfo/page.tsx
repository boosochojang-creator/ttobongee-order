import type { Metadata } from 'next'
import BackButton from '../lib/BackButton'

export const metadata: Metadata = {
  title: '사업자 정보 | 또봉이통닭 백운역점',
}

const BIZ_ROWS = [
  ['상호명', '또봉이통닭 백운역점'],
  ['대표자', '이정은'],
  ['사업자등록번호', '501-39-76978'],
  ['업종', '음식점업 / 치킨전문점'],
  ['소재지', '인천광역시 부평구 경원대로 1220 1층 일부호(십정동)'],
  ['전화번호', '032-299-9848'],
  ['이메일', 'boosochojang@naver.com'],
  ['영업시간', '매일 16:00 ~ 02:00 (연중무휴)'],
] as const

export default function BizInfoPage() {
  return (
    <main style={{ background: '#111', minHeight: '100vh', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
      <BackButton title="사업자 정보" />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 60px' }}>

        <div style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, overflow: 'hidden', marginBottom: 24 }}>
          {BIZ_ROWS.map(([label, value], i) => (
            <div key={label} style={{
              display: 'flex', padding: '14px 18px',
              borderBottom: i < BIZ_ROWS.length - 1 ? '1px solid #222' : 'none',
              gap: 16, alignItems: 'flex-start',
            }}>
              <span style={{ minWidth: 120, fontSize: 13, color: '#888', flexShrink: 0 }}>{label}</span>
              <span style={{ fontSize: 14, color: '#e0e0e0', lineHeight: 1.6 }}>{value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#1a1200', border: '1px solid #7a6400', borderRadius: 12, padding: '16px 18px', fontSize: 13, color: '#aaa', lineHeight: 1.9 }}>
          <div style={{ fontWeight: 700, color: '#c8a900', marginBottom: 8 }}>통신판매업 신고 안내</div>
          <p>
            본 QR 주문 서비스는 매장 내 테이블 주문을 위한 시스템으로, 전자상거래 등에서의 소비자보호에 관한 법률이 적용됩니다.
            소비자 분쟁 발생 시 공정거래위원회 전자상거래분쟁조정위원회를 통해 조정 신청이 가능합니다.
          </p>
          <p style={{ marginTop: 8 }}>
            소비자상담센터: <strong style={{ color: '#fff' }}>1372</strong> (한국소비자원)
          </p>
        </div>

        <div style={{ marginTop: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {[
            { label: '이용약관', href: '/terms' },
            { label: '개인정보처리방침', href: '/privacy' },
            { label: '환불정책', href: '/refund' },
          ].map(({ label, href }) => (
            <a key={href} href={href} style={{
              padding: '8px 14px', background: '#1a1a1a',
              border: '1px solid #333', borderRadius: 8,
              color: '#aaa', fontSize: 13, textDecoration: 'none',
            }}>
              {label}
            </a>
          ))}
        </div>
      </div>
    </main>
  )
}
