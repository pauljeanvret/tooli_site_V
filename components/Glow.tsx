'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface GlowProps {
  children?: React.ReactNode
  className?: string
  color?: 'primary' | 'accent'
  blur?: 'sm' | 'md' | 'lg'
}

export const Glow: React.FC<GlowProps> = ({ children, className, color = 'primary', blur = 'lg' }) => {
  const colors = {
    primary: 'from-toolia-primary/20 via-toolia-primary/5 to-transparent',
    accent: 'from-toolia-gradient-light/20 via-toolia-gradient-light/5 to-transparent',
  }

  const blurs = {
    sm: 'blur-3xl',
    md: 'blur-[80px]',
    lg: 'blur-[120px]',
  }

  return (
    <div className={cn('pointer-events-none absolute', className)}>
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-gradient-radial',
          colors[color],
          blurs[blur],
          'opacity-40'
        )}
        style={{
          backgroundImage: `
            radial-gradient(ellipse 80% 80% at 50% 50%, 
            ${color === 'primary' ? 'rgba(31, 42, 77, 0.2)' : 'rgba(47, 61, 107, 0.2)'} 0%, 
            transparent 70%)
          `,
        }}
      />
      {children}
    </div>
  )
}

Glow.displayName = 'Glow'
