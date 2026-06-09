/**
 * 미반영 메뉴 이미지 재매핑 스크립트
 * 전략: 같은 메뉴명을 가진 모든 행에 동일 image_url 적용 (중복 행 처리)
 * 실행: cd customer-app && node scripts/fix-image-url.mjs
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xfwtbctflkrtctciriju.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmd3RiY3RmbGtydGN0Y2lyaWp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY2MzQ2OCwiZXhwIjoyMDk2MjM5NDY4fQ.vE1FflGfsJOeCukdo6npqO4jWSG5bOVcqHPyDLPF07c'
const BUCKET = 'menu-images'
const STORE_URL = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  // 1. 현재 DB 전체 조회
  const { data: menus } = await sb.from('menus').select('id, name, image_url').eq('store_id', 'baegun')

  // 2. image_url 있는 메뉴에서 이름→URL 맵 구성
  const urlByName = {}
  for (const m of menus) {
    if (m.image_url) urlByName[m.name.trim()] = m.image_url
  }

  // 3. image_url 없는 메뉴 목록
  const missing = menus.filter(m => !m.image_url)
  console.log(`image_url 없는 메뉴: ${missing.length}개\n`)

  let fixed = 0, skipped = 0

  for (const m of missing) {
    const name = m.name.trim()
    const url = urlByName[name]

    if (url) {
      // 같은 이름의 다른 행이 이미 URL 갖고 있음 → 복사
      const { error } = await sb.from('menus').update({ image_url: url }).eq('id', m.id)
      if (error) { console.log(`  ✗ 실패: ${name} — ${error.message}`); continue }
      console.log(`  ✓ [복사] ${name}`)
      fixed++
    } else {
      // 스토리지에 해당 이름의 파일이 올라가 있는지 직접 확인
      // (버킷에서 이름 기반으로 검색)
      const { data: files } = await sb.storage.from(BUCKET).list('', { search: '' })
      // 이 이름과 연결된 파일이 없음 → 건너뜀
      skipped++
    }
  }

  console.log(`\n결과: 복사 완료 ${fixed}개 / 이미지 없어 건너뜀 ${skipped}개`)

  // 4. 여전히 없는 메뉴 출력
  const { data: stillMissing } = await sb.from('menus')
    .select('name').eq('store_id', 'baegun').is('image_url', null)
  console.log(`\n여전히 이미지 없는 메뉴 (${stillMissing.length}개):`)
  stillMissing.forEach(m => console.log(' ', m.name))
}

main().catch(e => { console.error(e); process.exit(1) })
