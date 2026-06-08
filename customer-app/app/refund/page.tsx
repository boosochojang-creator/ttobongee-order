import type { Metadata } from 'next'
import BackButton from '../lib/BackButton'

export const metadata: Metadata = {
  title: '환불정책 | 또봉이통닭 백운역점',
}

export default function RefundPage() {
  return (
    <main style={{ background: '#111', minHeight: '100vh', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
      <BackButton title="환불정책" />
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 60px', lineHeight: 1.9, fontSize: 14 }}>

        <div style={{ background: '#1a1200', border: '2px solid #c8a900', borderRadius: 12, padding: '16px 18px', marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#c8a900', marginBottom: 8 }}>환불 정책 요약</div>
          <div style={{ color: '#f0f0f0', lineHeight: 2 }}>
            · 조리 시작 전 취소 → 전액 환불<br />
            · 조리 시작 후 취소 → 환불 불가<br />
            · 카드·간편결제 환불 → 3~5 영업일 소요<br />
            · 현금 결제 환불 → 즉시 카운터 현금 반환
          </div>
        </div>

        <Section title="제1조 (취소 가능 시점)">
          <ol style={{ margin: '8px 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8, color: '#ccc' }}>
            <li><strong style={{ color: '#fff' }}>조리 시작 전</strong>: 직원 호출(🔔) 또는 카운터 요청 시 전액 환불</li>
            <li><strong style={{ color: '#fff' }}>접수 완료 ~ 조리 시작 전</strong>: 직원 확인 후 취소 처리</li>
            <li><strong style={{ color: '#e84040' }}>조리 시작 후</strong>: 식품 특성상 취소 및 환불 불가</li>
          </ol>
        </Section>

        <Section title="제2조 (결제 수단별 환불 방법)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Row icon="💳" label="신용/체크카드" desc="결제 취소 후 카드사 기준 3~5 영업일 이내 환불" />
            <Row icon="💛" label="카카오페이" desc="결제 취소 후 카카오페이 계정으로 3~5 영업일 이내 환불" />
            <Row icon="💙" label="토스페이" desc="결제 취소 후 토스페이 계정으로 3~5 영업일 이내 환불" />
            <Row icon="💵" label="현금결제" desc="카운터에서 즉시 현금 반환" />
          </div>
        </Section>

        <Section title="제3조 (매장 귀책 환불)">
          <p style={{ color: '#ccc' }}>이물질, 변질, 오주문 등 매장 귀책 사유는 수령 즉시 직원에게 알려주시면 조리 여부와 관계없이 교환 또는 전액 환불 처리합니다.</p>
        </Section>

        <Section title="제4조 (환불 불가 사유)">
          <ul style={{ margin: '8px 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6, color: '#ccc' }}>
            <li>조리가 시작된 음식</li>
            <li>이용자 단순 변심 (조리 시작 후)</li>
            <li>이용자 귀책 주문 오류</li>
          </ul>
        </Section>

        <Section title="제5조 (환불 신청 방법)">
          <div style={{ background: '#1a1a1a', padding: '14px 16px', borderRadius: 10, border: '1px solid #2a2a2a', color: '#ccc', lineHeight: 2 }}>
            <div>· <strong style={{ color: '#aaa' }}>매장 내</strong>: 직원 호출(🔔) 또는 카운터</div>
            <div>· <strong style={{ color: '#aaa' }}>전화</strong>: 032-299-9848</div>
            <div>· <strong style={{ color: '#aaa' }}>이메일</strong>: boosochojang@naver.com</div>
            <div>· <strong style={{ color: '#aaa' }}>주소</strong>: 인천광역시 부평구 경원대로 1220 1층 일부호(십정동)</div>
          </div>
        </Section>

        <p style={{ color: '#555', fontSize: 13, marginTop: 20 }}>
          소비자 분쟁 조정: 소비자상담센터 ☎ 1372 | 공정거래위원회 전자상거래분쟁조정위원회
        </p>
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

function Row({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div style={{ background: '#1a1a1a', borderRadius: 10, padding: '12px 14px', border: '1px solid #2a2a2a' }}>
      <div style={{ fontWeight: 600, color: '#fff', marginBottom: 4 }}>{icon} {label}</div>
      <div style={{ color: '#aaa', fontSize: 13 }}>{desc}</div>
    </div>
  )
}
