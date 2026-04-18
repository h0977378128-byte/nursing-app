import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'missing key' }, { status: 400 })

  const { data, error } = await supabase
    .from('nursing_data')
    .select('value')
    .eq('key', key)
    .single()

  if (error || !data) return NextResponse.json({ value: null })
  return NextResponse.json({ value: data.value })
}

export async function POST(request: NextRequest) {
  const { key, value } = await request.json()
  if (!key) return NextResponse.json({ error: 'missing key' }, { status: 400 })

  const { error } = await supabase
    .from('nursing_data')
    .upsert({ key, value, updated_at: new Date().toISOString() })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
