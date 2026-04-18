import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase env')
  }

  return createClient(url, key)
}

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')
    if (!key) {
      return NextResponse.json({ error: 'missing key' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('nursing_data')
      .select('value')
      .eq('key', key)
      .single()

    if (error || !data) {
      return NextResponse.json({ value: null })
    }

    return NextResponse.json({ value: data.value })
  } catch (e) {
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { key, value } = await request.json()

    if (!key) {
      return NextResponse.json({ error: 'missing key' }, { status: 400 })
    }

    const supabase = getSupabase()

    const { error } = await supabase
      .from('nursing_data')
      .upsert({
        key,
        value,
        updated_at: new Date().toISOString()
      })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'server error' }, { status: 500 })
  }
}