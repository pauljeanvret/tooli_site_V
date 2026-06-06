import { timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function safeBearerMatches(authorization: string | null, expected: string | undefined) {
  const cleanExpected = expected?.trim()
  const cleanAuthorization = authorization?.trim()
  const prefix = 'Bearer '

  if (!cleanExpected || !cleanAuthorization?.startsWith(prefix)) return false

  const provided = cleanAuthorization.slice(prefix.length)
  const providedBuffer = Buffer.from(provided)
  const expectedBuffer = Buffer.from(cleanExpected)

  if (providedBuffer.length !== expectedBuffer.length) return false

  return timingSafeEqual(providedBuffer, expectedBuffer)
}

async function readWorkerJson(response: Response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }

  return response.text().then((text) => ({ message: text.slice(0, 300) })).catch(() => null)
}

async function runCronWorker(request: NextRequest) {
  if (!safeBearerMatches(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ ok: false, step: 'cron_secret', message: 'Acces cron refuse.' }, { status: 401 })
  }

  const workerSecret = process.env.WORKER_SECRET?.trim()
  if (!workerSecret) {
    return NextResponse.json(
      { ok: false, step: 'worker_secret', message: 'WORKER_SECRET n’est pas configure.' },
      { status: 503 },
    )
  }

  const workerUrl = new URL('/api/worker/process-gmail', request.nextUrl.origin)
  const workerResponse = await fetch(workerUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-worker-secret': workerSecret,
    },
    body: JSON.stringify({}),
    cache: 'no-store',
  })
  const workerPayload = await readWorkerJson(workerResponse)

  if (!workerResponse.ok) {
    return NextResponse.json(
      {
        ok: false,
        step: 'worker',
        message: 'Execution du worker Gmail impossible.',
        workerStatus: workerResponse.status,
        worker: workerPayload,
      },
      { status: workerResponse.status },
    )
  }

  return NextResponse.json({
    ok: true,
    triggeredBy: 'vercel_cron',
    schedule: '*/5 * * * *',
    force: false,
    worker: workerPayload,
  })
}

export async function GET(request: NextRequest) {
  return runCronWorker(request)
}

export async function POST(request: NextRequest) {
  return runCronWorker(request)
}
