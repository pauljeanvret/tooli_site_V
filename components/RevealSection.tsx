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
          // once a section has crossed the threshold we mark it visible
          // and never switch it back off – this makes earlier blocks stay
          // on screen and prevents the "line" effect when scrolling past
          if (entry.intersectionRatio >= 0.35) {
            setVisible(true)
          }
        })
      },
      { threshold: [0, 0.35, 0.6] }
    )

    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={ref as any} className={cn('reveal-wrapper relative w-full', className)}>
      {/* content container */}
      <div className={cn('reveal-container w-full', visible ? 'reveal-visible' : '')}>
        <div className="reveal-content w-full">{children}</div>
      </div>
    </div>
  )
}

RevealSection.displayName = 'RevealSection'
