import React from 'react'
import { cn } from '@/lib/utils'

type BrandFlowLinesProps = {
  className?: string
}

export function BrandFlowLines({ className }: BrandFlowLinesProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute overflow-hidden text-[#16224A]/[0.055] dark:text-sky-300/[0.065]', className)}
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 980 420"
        fill="none"
        preserveAspectRatio="none"
      >
        <path
          d="M-92 238C86 88 210 364 386 214C568 58 686 128 842 248C916 305 980 316 1080 270"
          stroke="currentColor"
          strokeWidth="1.15"
          strokeLinecap="round"
        />
        <path
          d="M-42 304C148 154 292 406 468 254C624 120 760 132 924 228C986 264 1036 274 1100 250"
          stroke="currentColor"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
        <path
          d="M42 136C190 32 304 202 452 126C604 48 734 54 906 146"
          stroke="currentColor"
          strokeWidth="0.75"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
