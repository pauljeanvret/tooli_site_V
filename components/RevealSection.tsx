'use client'

import React, { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface RevealSectionProps {
  children: React.ReactNode
  className?: string
}

export const RevealSection: React.FC<RevealSectionProps> = ({ children, className }) => {
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Réactive l'animation à chaque fois que la section dépasse 35% visible
          setVisible(entry.intersectionRatio >= 0.35)
        })
      },
      { threshold: [0, 0.35, 0.6] }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref as any} className={cn('reveal-wrapper relative overflow-hidden w-full', className)}>
      {/* soft top mask */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-toolia-bg-main/80 via-toolia-bg-main/40 to-transparent opacity-60" />

      <div className={cn('reveal-container w-full', visible ? 'reveal-visible' : '')}>
        <div className="reveal-content w-full">{children}</div>
      </div>

      {/* soft bottom mask */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-toolia-bg-main/80 via-toolia-bg-main/40 to-transparent opacity-60" />
    </div>
  )
}

RevealSection.displayName = 'RevealSection'
