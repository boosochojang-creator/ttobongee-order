/**
 * 또봉이 이미지 일괄 업로드 스크립트
 * 실행: node scripts/upload-images.mjs  (customer-app 디렉토리에서)
 * cd customer-app && node ../scripts/upload-images.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { extname, basename, join } from 'path'

const SUPABASE_URL = 'https://xfwtbctflkrtctciriju.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhmd3RiY3RmbGtydGN0Y2lyaWp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDY2MzQ2OCwiZXhwIjoyMDk2MjM5NDY4fQ.vE1FflGfsJOeCukdo6npqO4jWSG5bOVcqHPyDLPF07c'
const IMAGE_DIR = 'C:/Users/DSEKTOP/Downloads/또봉이 이미지'
const BUCKET = 'menu-images'

const SKIP_FILES = ['또봉이통닭 모바일 아이콘.png', '미안해지지마.mp3']
const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.webp']

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  // 버킷 생성 (없으면)
  const { error: bucketErr } = await supabase.storage.createBucket(BUCKET, { public: true })
  if (bucketErr && !bucketErr.message.includes('already exists')) {
    console.error('버킷 생성 실패:', bucketErr.message); process.exit(1)
  }
  console.log(`버킷 "${BUCKET}" 준비 완료`)


  const { data: menus, error: menuErr } = await supabase
    .from('menus').select('id, name').eq('store_id', 'baegun')

  if (menuErr) { console.error('메뉴 조회 실패:', menuErr.message); process.exit(1) }
  console.log(`\n메뉴 ${menus.length}개 조회 완료`)

  const menuMap = {}
  for (const m of menus) menuMap[m.name.trim()] = m.id

  const files = readdirSync(IMAGE_DIR).filter(f => {
    const ext = extname(f).toLowerCase()
    return IMAGE_EXTS.includes(ext) && !SKIP_FILES.includes(f)
  })
  console.log(`이미지 파일 ${files.length}개 발견\n`)

  let matched = 0, unmatched = 0, errors = 0

  for (const file of files) {
    const ext = extname(file).toLowerCase()
    const menuName = basename(file, ext).trim()
    const menuId = menuMap[menuName]
    const fileBuffer = readFileSync(join(IMAGE_DIR, file))
    const contentType = (ext === '.jpg' || ext === '.jpeg') ? 'image/jpeg' : 'image/png'

    // 스토리지 key: 매칭된 경우 menuId 사용, 없으면 인코딩된 원본명
    const storageKey = menuId
      ? `${menuId}${ext}`
      : encodeURIComponent(basename(file, ext)) + ext

    const { error: upErr } = await supabase.storage
      .from(BUCKET).upload(storageKey, fileBuffer, { contentType, upsert: true })

    if (upErr) { console.error(`  ✗ 업로드 실패: ${menuName} — ${upErr.message}`); errors++; continue }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storageKey)
    const publicUrl = urlData.publicUrl

    if (menuId) {
      const { error: dbErr } = await supabase.from('menus')
        .update({ image_url: publicUrl }).eq('id', menuId)
      if (dbErr) { console.error(`  ✗ DB 업데이트 실패: ${menuName} — ${dbErr.message}`); errors++ }
      else { console.log(`  ✓ [매칭] ${menuName}`); matched++ }
    } else {
      console.log(`  ~ [업로드만] ${menuName}`)
      unmatched++
    }
  }

  console.log(`\n완료:`)
  console.log(`  메뉴 매칭+업데이트: ${matched}개`)
  console.log(`  업로드만 (메뉴 없음): ${unmatched}개`)
  console.log(`  오류: ${errors}개`)
}

main().catch(e => { console.error(e); process.exit(1) })
