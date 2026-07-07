// Phase 5-2-e-2: 비밀글 사진 90일 자동삭제 (텍스트는 유지). 별도 함수로 분리 — 주기 조정 쉽게.
import type { SupabaseClient } from '@supabase/supabase-js'

export async function purgePostImages(admin: SupabaseClient, days = 90) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString()
  const { data: old } = await admin.from('posts')
    .select('id, image_url').not('image_url', 'is', null).lt('created_at', cutoff)
  let purged = 0
  for (const p of old || []) {
    try {
      await admin.storage.from('post-images').remove([p.image_url]).catch(() => {})
      await admin.from('posts').update({ image_url: null, image_purged_at: new Date().toISOString() }).eq('id', p.id)
      purged++
    } catch {}
  }
  return { checked: (old || []).length, purged }
}
