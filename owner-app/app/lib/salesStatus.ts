// [3][4][11] 매출 집계 단일 기준 — 요약카드·매출탭·영업마감·통계 전부 이 목록 하나로 통일.
// 확정 매출 = 실제 결제 완료(전자결제 paid~) 또는 현금 접수 완료(accepted~). 미결제/미확정/취소는 제외.
//  포함: paid(전자결제 완료), accepted, cooking, done, served, out_for_delivery, delivered
//  제외: pending(전자 미결제), cash_pending(카운터 결제 전=미수금), verification_failed(검증실패), canceled
// (CouponStats.COUNTED / customerStats.COUNTED / CRM_COUNTED 와 동일 집합 — 매출=CRM 완료주문 기준)
export const SALES_COUNTED: string[] = ['paid', 'accepted', 'cooking', 'done', 'served', 'out_for_delivery', 'delivered']
