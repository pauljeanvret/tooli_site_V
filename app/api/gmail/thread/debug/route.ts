import { NextRequest, NextResponse } from 'next/server'
import { buildThreadContextForAI, fetchGmailThread } from '@/lib/saas/gmail-thread'
import { getConnectedGmailConnection, hasGmailModifyScope } from '@/lib/saas/gmail-store'
import { requirePaidSaasRouteAccess } from '@/lib/saas/route-access'

export async function GET(request: NextRequest) {
  const access = await requirePaidSaasRouteAccess(
    request,
    'Un abonnement Toolia actif est requis pour lire un fil Gmail.',
  )
  if (access.response) return access.response
  const user = access.user

  const threadId = request.nextUrl.searchParams.get('threadId')?.trim()
  if (!threadId) {
    return NextResponse.json({ ok: false, message: 'threadId manquant.' }, { status: 400 })
  }

  const connection = await getConnectedGmailConnection(user.id)
  if (!connection) {
    return NextResponse.json({ ok: false, message: 'Gmail non connecté.' }, { status: 400 })
  }

  if (!hasGmailModifyScope(connection)) {
    return NextResponse.json({ ok: false, message: 'Autorisation Gmail à mettre à jour.' }, { status: 403 })
  }

  try {
    const thread = await fetchGmailThread(user.id, threadId)

    return NextResponse.json({
      ok: true,
      context: buildThreadContextForAI(thread),
    })
  } catch {
    return NextResponse.json({ ok: false, message: 'Lecture du fil Gmail impossible.' }, { status: 500 })
  }
}
