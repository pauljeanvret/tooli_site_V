'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface RevealSectionProps {
  children: React.ReactNode
  className?: string
}

export const RevealSection: React.FC<RevealSectionProps> = ({ children, className }) => {
  return (
    <div className={cn('reveal-wrapper relative w-full', className)}>
      <div className="reveal-container w-full">
        <div className="reveal-content w-full">{children}</div>
      </div>
    </div>
  )
}

RevealSection.displayName = 'RevealSection'
