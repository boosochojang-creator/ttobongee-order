import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    if (!file) return NextResponse.json({ ok: false, error: '파일 누락' }, { status: 400 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const ext = file.name.split('.').pop()
    const path = `baegun.${ext}`
    const bytes = await file.arrayBuffer()

    const { error: uploadErr } = await admin.storage
      .from('bgm')
      .upload(path, bytes, { contentType: file.type, upsert: true })

    if (uploadErr) throw uploadErr

    const { data: { publicUrl } } = admin.storage.from('bgm').getPublicUrl(path)

    const { error: updateErr } = await admin
      .from('stores')
      .update({ bgm_url: publicUrl })
      .eq('id', 'baegun')

    if (updateErr) throw updateErr

    return NextResponse.json({ ok: true, url: publicUrl })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
