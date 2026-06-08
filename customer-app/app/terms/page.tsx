'use client'
import { useRouter } from 'next/navigation'

export default function TermsPage() {
  const router = useRouter()
  return (
    <main style={{ background: '#111', minHeight: '100vh', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
      <div style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #222', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#e0e0e0', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>이용약관</span>
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 60px', lineHeight: 1.9, fontSize: 14 }}>
        <p style={{ color: '#888', marginBottom: 24 }}>시행일: 2024년 1월 1일</p>

        <Section title="제1조 (목적)">
          이 약관은 또봉이통닭 백운역점(이하 "매장")이 제공하는 QR코드 기반 테이블 주문 서비스(이하 "서비스")의 이용 조건 및 절차, 이용자와 매장 사이의 권리·의무·책임사항을 규정함을 목적으로 합니다.
        </Section>

        <Section title="제2조 (서비스 내용)">
          매장은 이용자가 QR코드를 통해 스마트폰으로 메뉴를 확인하고 주문·결제를 진행할 수 있는 온라인 주문 서비스를 제공합니다. 서비스는 매장 영업 시간 내에 이용 가능하며, 시스템 점검 등의 사유로 일시 중단될 수 있습니다.
        </Section>

        <Section title="제3조 (주문 및 결제)">
          <ol style={{ margin: '8px 0 0 16px', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>이용자는 메뉴를 선택하고 결제 수단(신용/체크카드, 카카오페이, 토스페이, 현금)을 선택하여 주문을 완료합니다.</li>
            <li>현금 결제의 경우 주문 완료 후 카운터에서 직접 결제하셔야 합니다.</li>
            <li>전자결제(카드·간편결제)는 결제대행사(주식회사 포트원)를 통해 처리됩니다.</li>
            <li>매장은 주문을 접수하는 즉시 조리를 시작할 수 있으며, 접수 확인 후 취소가 제한될 수 있습니다.</li>
          </ol>
        </Section>

        <Section title="제4조 (취소 및 환불)">
          <ol style={{ margin: '8px 0 0 16px', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong>조리 시작 전</strong>: 주문 취소 및 전액 환불 가능 (직원 호출 또는 카운터 문의)</li>
            <li><strong>조리 시작 후</strong>: 원칙적으로 취소 및 환불 불가</li>
            <li><strong>상품 하자</strong>: 수령 즉시 직원에게 알려주시면 교환 또는 환불 처리합니다.</li>
            <li>카드·간편결제 환불은 결제 취소 처리 후 3~5 영업일 이내에 이루어집니다.</li>
            <li>현금 결제 환불은 즉시 카운터에서 현금으로 반환합니다.</li>
          </ol>
          <p style={{ marginTop: 8, color: '#aaa' }}>자세한 내용은 <a href="/refund" style={{ color: '#c8a900' }}>환불정책</a>을 참고하세요.</p>
        </Section>

        <Section title="제5조 (면책조항)">
          <ol style={{ margin: '8px 0 0 16px', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>매장은 천재지변, 네트워크 장애, 기타 불가항력으로 인한 서비스 중단에 대해 책임을 지지 않습니다.</li>
            <li>이용자의 귀책사유로 인한 주문 오류에 대해 매장은 책임을 지지 않습니다.</li>
            <li>매장 메뉴의 사진·설명은 실제 제품과 다소 차이가 있을 수 있습니다.</li>
          </ol>
        </Section>

        <Section title="제6조 (개인정보 보호)">
          매장은 서비스 제공을 위해 필요한 최소한의 개인정보를 수집·이용합니다. 자세한 내용은 <a href="/privacy" style={{ color: '#c8a900' }}>개인정보처리방침</a>을 참고하세요.
        </Section>

        <Section title="제7조 (분쟁 해결)">
          서비스 이용과 관련한 분쟁은 매장과 이용자가 협의하여 해결하는 것을 원칙으로 하며, 협의가 이루어지지 않을 경우 소비자분쟁해결기준에 따릅니다.
        </Section>

        <BizBox />
      </div>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: '#c8a900', marginBottom: 10 }}>{title}</div>
      <div style={{ color: '#ccc' }}>{children}</div>
    </div>
  )
}

function BizBox() {
  return (
    <div style={{ marginTop: 32, padding: '16px', background: '#1a1a1a', borderRadius: 10, border: '1px solid #2a2a2a', fontSize: 13, color: '#888', lineHeight: 2 }}>
      <div><strong style={{ color: '#aaa' }}>상호</strong>: 또봉이통닭 백운역점</div>
      <div><strong style={{ color: '#aaa' }}>대표자</strong>: 이정은</div>
      <div><strong style={{ color: '#aaa' }}>사업자등록번호</strong>: 501-39-76978</div>
      <div><strong style={{ color: '#aaa' }}>주소</strong>: 인천광역시 부평구 경원대로 1220 1층 일부호(십정동)</div>
      <div><strong style={{ color: '#aaa' }}>전화</strong>: 032-299-9848</div>
      <div><strong style={{ color: '#aaa' }}>이메일</strong>: boosochojang@naver.com</div>
    </div>
  )
}
