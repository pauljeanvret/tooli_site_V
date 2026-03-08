'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  id?: string
  children: React.ReactNode
  className?: string
}

export const Section = React.forwardRef<HTMLElement, SectionProps>(({ id, children, className, ...props }, ref) => (
  <section
    ref={ref}
    id={id}
    className={cn(
      'w-full px-6 md:px-8 py-16 md:py-24 lg:py-32',
      className
    )}
    {...props}
  >
    <div className="max-w-layout mx-auto">
      {children}
    </div>
  </section>
))

Section.displayName = 'Section'
