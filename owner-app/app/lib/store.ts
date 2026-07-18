// 멀티매장 슬롯화: 이 점주앱 배포가 담당하는 매장 ID.
// 점주앱은 매장별로 배포(URL에 매장 없음·PIN 게이트)하므로 빌드 env로 지정한다.
// 매장 추가 시 해당 배포에 NEXT_PUBLIC_STORE_ID=<id> 를 지정. 미지정 시 기본 'baegun'.
export const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID || 'baegun'
