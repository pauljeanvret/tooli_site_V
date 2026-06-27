import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { generateAutomationProfile } from '@/lib/saas/profile-builder'
import { requireAuthenticatedRouteUser } from '@/lib/supabase/route-auth'
import { estimateTokensFromChars, recordAiCostUsage } from '@/lib/ai-costs'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedRouteUser(request)
    if (auth.response) return auth.response

    const body = await request.json()
    const result = await generateAutomationProfile(body.answers || body)
    if (result.mode !== 'mock') {
      const rawAnswers = body.answers || body
      await recordAiCostUsage({
        userId: auth.user.id,
        customerId: auth.user.id,
        plan: null,
        source: 'onboarding',
        actionType: 'profile_generation',
        provider: result.mode,
        model: result.model || null,
        promptTokens: estimateTokensFromChars(JSON.stringify(rawAnswers).length + 1800),
        completionTokens: estimateTokensFromChars(JSON.stringify(result.profile).length),
        metadata: {
          route: 'automation_profile_generate',
        },
        success: true,
      }).catch((costError) => {
        console.warn('[automation/profile/generate] AI cost logging failed', {
          message: costError instanceof Error ? costError.message : String(costError),
          provider: result.mode,
          model: result.model,
        })
      })
    }

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
