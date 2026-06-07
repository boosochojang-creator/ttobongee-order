# 또봉이통닭 백운역점 QR 주문 플랫폼

손님이 테이블 QR을 찍어 주문하고, 점주가 실시간으로 주문을 받아 처리하는 매장 주문 플랫폼.

## 구성

```
ttobongee-order/
  customer-app/   손님용 PWA (Next.js, 포트 3000)
  owner-app/      점주용 관리자 웹 (Next.js, 포트 3001)
  backend/        Supabase 스키마 + 시드 데이터
```

### customer-app (손님용)
- `/` 입구 QR 진입 → 테이블 선택
- `/store/[storeId]` 매장 메인
- `/store/[storeId]/menu` 메뉴 목록
- `/store/[storeId]/cart` 장바구니
- `/store/[storeId]/checkout` 결제 (PortOne V2)
- `/store/[storeId]/order-status` 주문완료/대기
- `/login` 로그인/회원가입 (휴대폰 기반)

### owner-app (점주용)
- `/` 대시보드 (주문현황)
- `/orders` 실시간 주문 목록
- `/menu-manage` 메뉴·품절 관리
- `/store-settings` 영업시간·매장정보
- `/qr-manage` QR코드 출력 관리

### backend
- `supabase/migrations/001_init.sql` DB 스키마 (stores, users, menus, orders, order_items, payments)
- `supabase/seed.sql` 백운역점(`baegun`) 메뉴 초기 데이터
- `.env.example` 환경변수 템플릿

## 주문 상태 흐름

```
pending → awaiting_approval → approved → paid / cash_pending → cooking → done
                                                                    └→ canceled
```

## 로컬 실행 방법

### 1. 환경변수 설정
```bash
cp backend/.env.example customer-app/.env.local
cp backend/.env.example owner-app/.env.local
# 각 파일에 Supabase / PortOne 키 입력
```

### 2. DB 초기화 (Supabase)
```bash
# Supabase 프로젝트 SQL Editor 또는 supabase CLI 에서 실행
backend/supabase/migrations/001_init.sql  # 스키마 생성
backend/supabase/seed.sql                  # 메뉴 데이터 삽입
```

### 3. 앱 실행
```bash
# 손님용
cd customer-app && npm install && npm run dev   # http://localhost:3000

# 점주용 (별도 터미널)
cd owner-app && npm install && npm run dev       # http://localhost:3001
```

## 기술 스택
- Frontend: Next.js 14 (App Router), React 18
- Backend/DB: Supabase (PostgreSQL + Realtime)
- 결제: PortOne V2
- 알림: 카카오 알림톡
