import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Phase 2: 배달료 계산 — 직선거리가 아닌 실주행거리(카카오내비 자동차 경로) 기준.
// 요금표는 stores.delivery_settings(DB 설정값)에서 읽고, 컬럼이 없으면 기본값 사용 (하드코딩 금지 원칙).
// 카카오 키: KAKAO_REST_API_KEY (developers.kakao.com REST 키, 카카오내비 사용 설정 필요)
// 테스트용으로 API 주소만 env로 교체 가능 (KAKAO_LOCAL_BASE / KAKAO_NAVI_BASE)

const LOCAL_BASE = process.env.KAKAO_LOCAL_BASE || 'https://dapi.kakao.com'
const NAVI_BASE = process.env.KAKAO_NAVI_BASE || 'https://apis-navi.kakaomobility.com'

// 배민 벤치마크 기본값 — DB delivery_settings가 있으면 그 값이 우선
const DEFAULT_SETTINGS = {
  tier1_max_m: 675, tier1_fee: 3000,
  tier2_max_m: 1900, tier2_fee: 3500,
  per_100m_fee: 80,
  notice_distance_m: 20000,
}

type Settings = typeof DEFAULT_SETTINGS

function calcFee(distanceM: number, s: Settings): number {
  if (distanceM < s.tier1_max_m) return s.tier1_fee
  if (distanceM < s.tier2_max_m) return s.tier2_fee
  return s.tier2_fee + Math.ceil((distanceM - s.tier2_max_m) / 100) * s.per_100m_fee
}

async function geocode(address: string, key: string): Promise<{ x: string; y: string } | null> {
  const res = await fetch(`${LOCAL_BASE}/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
    headers: { Authorization: `KakaoAK ${key}` }, cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  const doc = data.documents?.[0]
  return doc ? { x: doc.x, y: doc.y } : null
}

// 매장 좌표는 요청 간 캐시 (DB 좌표 → 없으면 매장 주소 지오코딩)
let storeCache: { x: string; y: string } | null = null

export async function POST(req: NextRequest) {
  try {
    const key = process.env.KAKAO_REST_API_KEY
    if (!key) return NextResponse.json({ ok: false, error: '지도 API 키 미설정 (KAKAO_REST_API_KEY)' }, { status: 503 })

    const { address } = await req.json()
    if (!address || String(address).trim().length < 5) {
      return NextResponse.json({ ok: false, error: '주소를 입력해주세요' }, { status: 400 })
    }

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data: store } = await db.from('stores').select('*').eq('id', 'baegun').single()

    const settings: Settings = { ...DEFAULT_SETTINGS, ...(store?.delivery_settings || {}) }

    // 매장 좌표: DB에 있으면 사용, 없으면 매장 주소를 지오코딩해 캐시
    if (!storeCache) {
      if (store?.lat && store?.lng) storeCache = { x: String(store.lng), y: String(store.lat) }
      else {
        storeCache = await geocode(store?.address || '인천 부평구 경원대로 1220', key)
        if (!storeCache) return NextResponse.json({ ok: false, error: '매장 좌표 확인 실패' }, { status: 500 })
      }
    }

    const dest = await geocode(String(address), key)
    if (!dest) return NextResponse.json({ ok: false, error: '주소를 찾을 수 없어요. 도로명주소로 다시 검색해주세요' }, { status: 400 })

    // 카카오내비 자동차 길찾기 → 실주행거리(m)
    const naviRes = await fetch(
      `${NAVI_BASE}/v1/directions?origin=${storeCache.x},${storeCache.y}&destination=${dest.x},${dest.y}&summary=true`,
      { headers: { Authorization: `KakaoAK ${key}` }, cache: 'no-store' },
    )
    if (!naviRes.ok) return NextResponse.json({ ok: false, error: '경로 계산에 실패했어요. 잠시 후 다시 시도해주세요' }, { status: 502 })
    const navi = await naviRes.json()
    const route = navi.routes?.[0]
    if (!route || route.result_code !== 0 || !route.summary?.distance) {
      return NextResponse.json({ ok: false, error: '배달 경로를 찾을 수 없어요' }, { status: 400 })
    }

    const distanceM: number = route.summary.distance
    const fee = calcFee(distanceM, settings)

    return NextResponse.json({
      ok: true,
      distanceM,
      distanceKm: Math.round(distanceM / 100) / 10,
      fee,
      farNotice: distanceM > settings.notice_distance_m, // 20km 초과 안내 (주문 차단 아님)
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
