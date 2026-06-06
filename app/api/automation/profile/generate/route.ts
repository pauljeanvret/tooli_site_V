import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { generateAutomationProfile } from '@/lib/saas/profile-builder'
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const result = await generateAutomationProfile(body.answers || body)

    return NextResponse.json({
      ok: true,
      ...result,
    })
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Invalid onboarding answers',
          issues: error.issues,
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Profile generation failed',
      },
      { status: 500 },
    )
  }
}
