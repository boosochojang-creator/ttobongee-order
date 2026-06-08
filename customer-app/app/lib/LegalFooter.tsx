export default function LegalFooter() {
  return (
    <div style={{
      padding: '24px 16px 32px',
      borderTop: '1px solid #1e1e1e',
      marginTop: 16,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
    }}>
      <div style={{ fontSize: 12, color: '#444', textAlign: 'center', lineHeight: 1.8 }}>
        또봉이통닭 백운역점 | 대표: 이정은 | 사업자번호: 501-39-76978<br />
        인천광역시 부평구 경원대로 1220 1층 | ☎ 032-299-9848
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {[
          { label: '이용약관', href: '/terms' },
          { label: '개인정보처리방침', href: '/privacy' },
          { label: '환불정책', href: '/refund' },
          { label: '사업자정보', href: '/bizinfo' },
        ].map(({ label, href }) => (
          <a key={href} href={href} style={{ fontSize: 12, color: '#555', textDecoration: 'underline', textUnderlineOffset: 2 }}>
            {label}
          </a>
        ))}
      </div>
    </div>
  )
}
