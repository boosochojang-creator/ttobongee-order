import type { Metadata } from 'next'
import BackButton from '../lib/BackButton'

export const metadata: Metadata = {
  title: '개인정보처리방침 | 또봉이통닭 백운역점',
}

export default function PrivacyPage() {
  return (
    <main style={{ background: '#111', minHeight: '100vh', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
      <BackButton title="개인정보처리방침" />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 60px', lineHeight: 1.9, fontSize: 14 }}>
        <p style={{ color: '#888', marginBottom: 24 }}>시행일: 2024년 1월 1일 | 최종 수정: 2025년 1월 1일</p>

        <p style={{ color: '#ccc', marginBottom: 28 }}>
          또봉이통닭 백운역점(이하 "매장")은 개인정보 보호법 및 관련 법령에 따라 이용자의 개인정보를 보호하고, 이와 관련한 고충을 신속하게 처리할 수 있도록 다음과 같이 개인정보처리방침을 수립·공개합니다.
        </p>

        <Section title="제1조 (수집하는 개인정보 항목)">
          <Table rows={[
            ['구분', '수집 항목', '필수 여부'],
            ['단골 등록', '휴대폰 번호', '선택'],
            ['전자결제', '카드번호(마스킹), 결제 수단 정보', '결제 시 필수'],
            ['주문 내역', '주문 메뉴, 금액, 테이블 번호, 결제 수단', '필수'],
          ]} />
          <p style={{ marginTop: 10, color: '#aaa' }}>전자결제 정보는 결제대행사(포트원)를 통해 처리되며, 매장은 카드 원본 정보를 저장하지 않습니다.</p>
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
        </Section>

        <Section title="제4조 (개인정보 제3자 제공)">
          <p style={{ color: '#ccc', marginBottom: 10 }}>매장은 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. 단, 아래의 경우 제공합니다.</p>
          <Table rows={[
            ['제공받는 자', '제공 목적', '제공 항목', '보유 기간'],
            ['주식회사 포트원', '전자결제 처리', '결제 수단 정보, 금액', '결제 완료 후 5년'],
          ]} />
        </Section>

        <Section title="제5조 (개인정보 처리 위탁)">
          <Table rows={[
            ['수탁업체', '위탁 업무'],
            ['주식회사 포트원', '전자결제 처리 및 관리'],
            ['Supabase Inc.', '데이터베이스 저장 및 관리'],
          ]} />
        </Section>

        <Section title="제6조 (이용자의 권리)">
          <p style={{ color: '#ccc' }}>이용자는 언제든지 개인정보 열람, 정정, 삭제, 처리정지를 요청할 수 있습니다. 요청은 아래 개인정보보호책임자에게 이메일 또는 전화로 연락하시면 됩니다.</p>
        </Section>

        <Section title="제7조 (개인정보보호책임자)">
          <div style={{ background: '#1a1a1a', padding: '14px 16px', borderRadius: 10, border: '1px solid #2a2a2a', color: '#ccc', lineHeight: 2 }}>
            <div><strong style={{ color: '#aaa' }}>성명</strong>: 이정은 (대표)</div>
            <div><strong style={{ color: '#aaa' }}>전화</strong>: 032-299-9848</div>
            <div><strong style={{ color: '#aaa' }}>이메일</strong>: boosochojang@naver.com</div>
            <div><strong style={{ color: '#aaa' }}>주소</strong>: 인천광역시 부평구 경원대로 1220 1층 일부호(십정동)</div>
          </div>
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
                <td key={j} style={{ padding: '9px 10px', color: i === 0 ? '#c8a900' : '#ccc', fontWeight: i === 0 ? 600 : 400, whiteSpace: 'nowrap' }}>
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
