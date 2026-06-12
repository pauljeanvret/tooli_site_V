'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, label, error, ...props }, ref) => (
  <div className="w-full">
    {label && <label className="block text-sm font-medium text-toolia-text mb-2">{label}</label>}
    <input
      ref={ref}
      className={cn(
        'w-full px-4 py-3 rounded-card border border-toolia-border-subtle bg-toolia-card text-toolia-text placeholder-toolia-text-muted shadow-sm transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-toolia-info focus-visible:border-toolia-info',
        error && 'border-toolia-danger',
        className
      )}
      {...props}
    />
    {error && <p className="text-xs text-toolia-danger mt-1">{error}</p>}
  </div>
))

Input.displayName = 'Input'
