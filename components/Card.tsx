'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'bg-toolia-card rounded-card border border-toolia-border-subtle p-6 md:p-7 shadow-soft transition-all duration-200 hover:bg-toolia-card-hover hover:border-toolia-primary/30',
      className
    )}
    {...props}
  >
    {children}
  </div>
))

Card.displayName = 'Card'
