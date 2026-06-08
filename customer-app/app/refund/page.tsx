'use client'
import { useRouter } from 'next/navigation'

export default function RefundPage() {
  const router = useRouter()
  return (
    <main style={{ background: '#111', minHeight: '100vh', color: '#e0e0e0', fontFamily: 'sans-serif' }}>
      <div style={{ position: 'sticky', top: 0, background: '#111', borderBottom: '1px solid #222', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#e0e0e0', fontSize: 20, cursor: 'pointer', padding: 0 }}>←</button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>환불정책</span>
      </div>
      <div style={{ maxWidth: 680, margin: '0 auto', padding: '24px 20px 60px', lineHeight: 1.9, fontSize: 14 }}>

        {/* 요약 박스 */}
        <div style={{ background: '#1a1200', border: '2px solid #c8a900', borderRadius: 12, padding: '16px 18px', marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#c8a900', marginBottom: 8 }}>📋 환불 정책 요약</div>
          <div style={{ color: '#f0f0f0', lineHeight: 2 }}>
            • 조리 시작 전 취소 → <strong style={{ color: '#3ac47d' }}>전액 환불</strong><br />
            • 조리 시작 후 취소 → <strong style={{ color: '#e84040' }}>환불 불가</strong><br />
            • 카드·간편결제 환불 → <strong>3~5 영업일 소요</strong><br />
            • 현금 결제 환불 → <strong>즉시 카운터 현금 반환</strong>
          </div>
        </div>

        <Section title="제1조 (취소 가능 시점)">
          <ol style={{ margin: '8px 0 0 16px', display: 'flex', flexDirection: 'column', gap: 8, color: '#ccc' }}>
            <li>
              <strong style={{ color: '#fff' }}>조리 시작 전</strong>: 직원 호출 버튼(🔔) 또는 카운터에서 취소를 요청하시면 전액 환불됩니다.
            </li>
            <li>
              <strong style={{ color: '#fff' }}>접수 완료 후 조리 시작 전</strong>: 주문 상태가 &apos;확인완료&apos; 단계까지는 취소 요청이 가능합니다. 단, 직원 확인 후 처리됩니다.
            </li>
            <li>
              <strong style={{ color: '#e84040' }}>조리 시작 후(조리중 이후)</strong>: 식품 위생 및 음식 특성상 조리가 시작된 이후에는 취소 및 환불이 불가합니다.
            </li>
          </ol>
        </Section>

        <Section title="제2조 (결제 수단별 환불 방법)">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Row icon="💳" label="신용/체크카드" desc="결제 취소 처리 후 카드사 영업일 기준 3~5일 이내 환불. 카드사별로 일부 차이가 있을 수 있습니다." />
            <Row icon="💛" label="카카오페이" desc="결제 취소 처리 후 카카오페이 계정으로 3~5 영업일 이내 환불." />
            <Row icon="💙" label="토스페이" desc="결제 취소 처리 후 토스페이 계정으로 3~5 영업일 이내 환불." />
            <Row icon="💵" label="현금결제" desc="카운터에서 즉시 현금으로 반환합니다." />
          </div>
        </Section>

        <Section title="제3조 (상품 하자에 의한 환불)">
          <p style={{ color: '#ccc' }}>
            제공된 음식에 이물질이 발견되거나 변질·오주문 등 매장 귀책 사유가 있는 경우, 수령 즉시 직원에게 알려주시면 교환 또는 전액 환불 처리합니다. 이 경우 조리 여부와 관계없이 환불이 가능합니다.
          </p>
        </Section>

        <Section title="제4조 (환불 불가 사유)">
          <ul style={{ margin: '8px 0 0 16px', display: 'flex', flexDirection: 'column', gap: 6, color: '#ccc' }}>
            <li>이미 조리가 시작된 음식</li>
            <li>이용자의 단순 변심 (조리 시작 후)</li>
            <li>주문 오류가 이용자 귀책인 경우</li>
          </ul>
        </Section>

        <Section title="제5조 (환불 신청 방법)">
          <div style={{ background: '#1a1a1a', padding: '14px 16px', borderRadius: 10, border: '1px solid #2a2a2a', color: '#ccc', lineHeight: 2 }}>
            <div>• <strong style={{ color: '#aaa' }}>매장 내</strong>: 직원 호출(🔔) 또는 카운터 직접 문의</div>
            <div>• <strong style={{ color: '#aaa' }}>전화</strong>: 032-299-9848</div>
            <div>• <strong style={{ color: '#aaa' }}>이메일</strong>: boosochojang@naver.com</div>
          </div>
          <p style={{ marginTop: 8, color: '#888', fontSize: 13 }}>영업시간 외 문의는 이메일로 남겨주시면 영업 시작 후 순차적으로 답변드립니다.</p>
        </Section>

        <p style={{ color: '#555', fontSize: 13, marginTop: 20 }}>
          소비자 분쟁 해결 기준에 관한 자세한 사항은 공정거래위원회 홈페이지를 참고하시거나 소비자상담센터(☎ 1372)로 문의하실 수 있습니다.
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
