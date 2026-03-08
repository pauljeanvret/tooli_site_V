'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, children, disabled, ...props }, ref) => {
    const baseClasses = 'font-medium rounded-btn transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed'

    const variants = {
      primary:
        'bg-toolia-primary hover:bg-toolia-primary-light active:bg-toolia-primary-dark text-white shadow-btn-primary hover:shadow-btn-hover hover:-translate-y-0.5',
      secondary:
        'bg-toolia-gradient-dark/20 border border-toolia-primary/40 text-toolia-text hover:bg-toolia-gradient-dark/30 hover:border-toolia-primary/60 hover:-translate-y-0.5',
      outline:
        'bg-transparent border border-toolia-border-subtle text-toolia-text hover:bg-toolia-card-hover hover:border-toolia-primary',
      ghost: 'bg-transparent text-toolia-text hover:bg-toolia-card',
    }

    const sizes = {
      sm: 'px-4 py-2 text-sm',
      md: 'px-[18px] py-3 text-base',
      lg: 'px-[22px] py-4 text-base',
    }

    return (
      <motion.button
        ref={ref}
        className={cn(baseClasses, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        whileHover={{ y: -1 }}
        whileTap={{ y: 0 }}
        transition={{ duration: 0.2 }}
        {...(props as any)}
      >
        {isLoading && (
          <svg className="w-4 h-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </motion.button>
    )
  }
)

Button.displayName = 'Button'
