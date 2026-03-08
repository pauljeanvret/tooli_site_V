'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'primary' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
  children: React.ReactNode
}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'primary', size = 'sm', children, ...props }, ref) => {
    const baseClasses = 'inline-flex items-center font-medium rounded-full'

    const variants = {
      primary: 'bg-toolia-primary/15 border border-toolia-primary/40 text-toolia-primary-light',
      success: 'bg-toolia-success/15 border border-toolia-success/40 text-toolia-success',
      warning: 'bg-toolia-warning/15 border border-toolia-warning/40 text-toolia-warning',
      danger: 'bg-toolia-danger/15 border border-toolia-danger/40 text-toolia-danger',
    }

    const sizes = {
      sm: 'px-3 py-1 text-xs',
      md: 'px-4 py-2 text-sm',
    }

    return (
      <div ref={ref} className={cn(baseClasses, variants[variant], sizes[size], className)} {...props}>
        {children}
      </div>
    )
  }
)

Badge.displayName = 'Badge'
