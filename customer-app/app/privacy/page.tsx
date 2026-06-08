'use client'
import { useRouter } from 'next/navigation'

export default function PrivacyPage() {
  const router = useRouter()
  return (
    <main style={{ background: '#111', minHeight: '100vh', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
      <div style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #222', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#e0e0e0', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>개인정보처리방침</span>
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 60px', lineHeight: 1.9, fontSize: 14 }}>
        <p style={{ color: '#888', marginBottom: 24 }}>시행일: 2024년 1월 1일 | 최종 수정: 2025년 1월 1일</p>

        <p style={{ color: '#ccc', marginBottom: 28 }}>
          또봉이통닭 백운역점(이하 "매장")은 『개인정보 보호법』 및 관련 법령에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <Section title="제1조 (수집하는 개인정보 항목)">
          <Table rows={[
            ['구분', '수집 항목', '필수 여부'],
            ['단골 등록', '휴대폰 번호', '선택'],
            ['전자결제', '카드번호(마스킹), 결제 수단 정보', '결제 시 필수'],
            ['주문 내역', '주문 메뉴, 금액, 테이블 번호, 결제 수단', '필수'],
          ]} />
          <p style={{ marginTop: 10, color: '#aaa' }}>※ 전자결제 정보는 결제대행사(포트원)를 통해 처리되며, 매장은 카드 원본 정보를 저장하지 않습니다.</p>
        </Section>

        <Section title="제2조 (개인정보 수집 목적)">
          <ul style={{ margin: '8px 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6, color: '#ccc' }}>
            <li>QR 주문 서비스 제공 및 주문 처리</li>
            <li>단골 혜택(5% 할인) 제공</li>
            <li>결제 처리 및 환불 처리</li>
            <li>서비스 이용 분쟁 해결</li>
            <li>법령 상 의무 이행</li>
          </ul>
        </Section>

        <Section title="제3조 (개인정보 보유 및 이용 기간)">
          <Table rows={[
            ['항목', '보유 기간', '근거'],
            ['주문 내역', '5년', '전자상거래법 제6조'],
            ['결제 기록', '5년', '전자상거래법 제6조'],
            ['단골 등록 정보', '회원 탈퇴 시까지', '이용자 동의'],
          ]} />
          <p style={{ marginTop: 10, color: '#aaa' }}>보유 기간이 경과하거나 처리 목적이 달성된 경우 지체 없이 파기합니다.</p>
        </Section>

        <Section title="제4조 (개인정보 제3자 제공)">
          <p style={{ color: '#ccc', marginBottom: 10 }}>매장은 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 아래의 경우 제공합니다.</p>
          <Table rows={[
            ['제공받는 자', '제공 목적', '제공 항목', '보유 기간'],
            ['㈜포트원', '전자결제 처리', '결제 수단 정보, 금액', '결제 완료 후 5년'],
          ]} />
          <p style={{ marginTop: 10, color: '#aaa' }}>이 외 법령에 의거한 수사기관의 요구 시 제공될 수 있습니다.</p>
        </Section>

        <Section title="제5조 (개인정보 처리 위탁)">
          <Table rows={[
            ['수탁업체', '위탁 업무'],
            ['㈜포트원', '전자결제 처리 및 관리'],
            ['Supabase Inc.', '데이터베이스 저장 및 관리'],
          ]} />
        </Section>

        <Section title="제6조 (이용자의 권리)">
          <p style={{ color: '#ccc' }}>
            이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 요청은 아래 개인정보보호책임자에게 이메일 또는 전화로 연락하시면 됩니다.
          </p>
        </Section>

        <Section title="제7조 (개인정보의 파기)">
          <p style={{ color: '#ccc' }}>
            보유 기간이 경과하거나 처리 목적 달성 시 전자 파일은 복원 불가능한 방법으로 영구 삭제하며, 서면은 분쇄 또는 소각합니다.
          </p>
        </Section>

        <Section title="제8조 (개인정보보호책임자)">
          <div style={{ background: '#1a1a1a', padding: '14px 16px', borderRadius: 10, border: '1px solid #2a2a2a', color: '#ccc', lineHeight: 2 }}>
            <div><strong style={{ color: '#aaa' }}>성명</strong>: 이정은</div>
            <div><strong style={{ color: '#aaa' }}>직책</strong>: 대표</div>
            <div><strong style={{ color: '#aaa' }}>전화</strong>: 032-299-9848</div>
            <div><strong style={{ color: '#aaa' }}>이메일</strong>: boosochojang@naver.com</div>
          </div>
          <p style={{ marginTop: 10, color: '#aaa' }}>
            개인정보 침해 신고: <a href="https://privacy.kisa.or.kr" target="_blank" style={{ color: '#c8a900' }}>개인정보침해신고센터</a> (☎ 118)
          </p>
        </Section>
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#c8a900', marginBottom: 10 }}>{title}</div>
      {children}
    </div>
  )
}

function Table({ rows }: { rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #2a2a2a', background: i === 0 ? '#1a1a1a' : 'transparent' }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: '9px 10px',
                  color: i === 0 ? '#c8a900' : '#ccc',
                  fontWeight: i === 0 ? 600 : 400,
                  whiteSpace: 'nowrap',
                }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
