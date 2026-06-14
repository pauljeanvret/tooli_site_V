'use client'

import { track as trackVercelEvent } from '@vercel/analytics'

type AnalyticsParamValue = string | number | boolean | null | undefined
type AnalyticsParams = Record<string, AnalyticsParamValue>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function sanitizeParams(params?: AnalyticsParams) {
  if (!params) return {}

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== null && value !== undefined),
  ) as Record<string, string | number | boolean>
}

export function trackEvent(eventName: string, params?: AnalyticsParams) {
  if (typeof window === 'undefined') return

  const safeParams = sanitizeParams(params)

  if (process.env.NODE_ENV === 'development') {
    console.log('[analytics]', eventName, safeParams)
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, safeParams)
  }

  try {
    trackVercelEvent(eventName, safeParams)
  } catch {
    // Analytics must never break the user flow.
  }
}
