import { NextRequest, NextResponse } from 'next/server'

import { ensureRealGmailLabels } from '@/lib/saas/gmail-store'
import { requirePaidSaasRouteAccess } from '@/lib/saas/route-access'

export async function POST(request: NextRequest) {
  const access = await requirePaidSaasRouteAccess(
    request,
    'Un abonnement Toolia actif est requis pour créer les labels Gmail.',
  )
  if (access.response) return access.response

  try {
    const result = await ensureRealGmailLabels(access.user.id)

    return NextResponse.json({
      ok: true,
      created: result.created,
      existing: result.existing,
      updatedColors: result.updatedColors,
      oldPrefixedLabelsDetected: result.oldPrefixedLabelsDetected,
      warnings: result.warnings,
      errors: result.errors,
    })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Création des labels Gmail impossible.',
      },
      { status: 500 },
    )
  }
}
