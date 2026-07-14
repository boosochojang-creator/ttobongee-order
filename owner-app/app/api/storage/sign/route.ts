import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

// 브라우저 직접 업로드용 서명 URL 발급 (서비스롤). Vercel 4.5MB 함수 제한을 우회 —
// 파일은 브라우저가 스토리지로 직접 올리고, 함수는 짧은 서명 URL만 내려준다.
const BUCKETS: Record<string, string> = { music: 'audio', games: 'html' } // 허용 버킷만

export async function POST(req: NextRequest) {
  try {
    const { bucket, ext } = await req.json()
    if (!bucket || !(bucket in BUCKETS)) {
      return NextResponse.json({ ok: false, error: '허용되지 않은 버킷' }, { status: 400 })
    }
    const safeExt = String(ext || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) || (bucket === 'games' ? 'html' : 'mp3')
    const path = `${randomUUID()}.${safeExt}`

    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path)
    if (error) throw error
    const { data: { publicUrl } } = admin.storage.from(bucket).getPublicUrl(path)
    return NextResponse.json({ ok: true, path: data.path, token: data.token, publicUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
