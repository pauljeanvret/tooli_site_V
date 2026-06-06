import { NextRequest, NextResponse } from 'next/server'
import { processActiveDemoUsers } from '@/lib/saas/demo-store'

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, message: 'Route de démonstration désactivée en production.' },
      { status: 404 },
    )
  }

  const body = await request.json().catch(() => ({}))
  const secret = typeof body.secret === 'string' ? body.secret : request.headers.get('x-worker-secret') || undefined
  const result = processActiveDemoUsers(secret)

  return NextResponse.json(result, { status: result.ok ? 200 : 401 })
}
