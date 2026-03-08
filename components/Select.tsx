'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  options: Array<{ value: string; label: string }>
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => (
    <div className="w-full">
      {label && <label className="block text-sm font-medium text-toolia-text mb-2">{label}</label>}
      <select
        ref={ref}
        className={cn(
          'w-full px-4 py-3 rounded-card border border-toolia-border-subtle bg-toolia-card-hover text-toolia-text transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-toolia-primary focus-visible:border-toolia-primary',
          error && 'border-toolia-danger',
          className
        )}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-toolia-danger mt-1">{error}</p>}
    </div>
  )
)

Select.displayName = 'Select'
