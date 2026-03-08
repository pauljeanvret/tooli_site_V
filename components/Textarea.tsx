'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, label, error, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-toolia-text mb-2">{label}</label>}
    <textarea
      ref={ref}
      className={cn(
        'w-full px-4 py-3 rounded-card border border-toolia-border-subtle bg-toolia-card-hover text-toolia-text placeholder-toolia-text-muted transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-toolia-primary focus-visible:border-toolia-primary resize-none',
        error && 'border-toolia-danger',
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-toolia-danger mt-1">{error}</p>}
  </div>
))

Textarea.displayName = 'Textarea'
