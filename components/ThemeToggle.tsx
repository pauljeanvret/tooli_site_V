'use client'

import React from 'react'
import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react'
import {
  applyTooliaTheme,
  getStoredTooliaTheme,
  setStoredTooliaTheme,
  watchSystemTheme,
  type TooliaTheme,
} from '@/lib/theme'
import { cn } from '@/lib/utils'

const themeOptions: Array<{ value: TooliaTheme; label: string; icon: LucideIcon }> = [
  { value: 'light', label: 'Clair', icon: Sun },
  { value: 'dark', label: 'Sombre', icon: Moon },
  { value: 'system', label: 'Système', icon: Monitor },
]

export function ThemeToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const [theme, setTheme] = React.useState<TooliaTheme>('light')

  React.useEffect(() => {
    const storedTheme = getStoredTooliaTheme() || 'light'
    setTheme(storedTheme)
    applyTooliaTheme(storedTheme)

    return watchSystemTheme(() => {
      const currentTheme = getStoredTooliaTheme() || 'light'
      if (currentTheme === 'system') applyTooliaTheme('system')
    })
  }, [])

  const updateTheme = (nextTheme: TooliaTheme) => {
    setTheme(nextTheme)
    setStoredTooliaTheme(nextTheme)
  }

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {!compact && <p className="text-xs font-semibold uppercase tracking-[0.12em] text-toolia-text-muted">Apparence</p>}
      <div className={cn('rounded-full border border-toolia-border-subtle bg-toolia-card p-1 shadow-sm', compact ? 'inline-flex' : 'grid w-full grid-cols-3 gap-1')}>
        {themeOptions.map((option) => {
          const Icon = option.icon
          const active = theme === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => updateTheme(option.value)}
              className={cn(
                'inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition focus-visible:ring-2 focus-visible:ring-toolia-info/35',
                active
                  ? 'bg-toolia-primary text-white shadow-btn-primary'
                  : 'text-toolia-text-secondary hover:bg-toolia-card-hover hover:text-toolia-text',
              )}
              aria-pressed={active}
            >
              <Icon size={14} />
              {!compact && option.label}
              {compact && <span className="sr-only">{option.label}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
