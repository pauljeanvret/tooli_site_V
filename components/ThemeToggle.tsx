'use client'

import React from 'react'
import { flushSync } from 'react-dom'
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

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>
    finished: Promise<void>
  }
}

const themeTransitionDuration = 640
const themeTransitionEasing = 'cubic-bezier(0.22, 1, 0.36, 1)'

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

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

  const commitTheme = React.useCallback((nextTheme: TooliaTheme) => {
    flushSync(() => setTheme(nextTheme))
    setStoredTooliaTheme(nextTheme)
  }, [])

  const updateTheme = (nextTheme: TooliaTheme, event: React.MouseEvent<HTMLButtonElement>) => {
    if (nextTheme === theme) return

    const transitionDocument = document as ViewTransitionDocument
    if (!transitionDocument.startViewTransition || prefersReducedMotion()) {
      commitTheme(nextTheme)
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const originX = rect.left + rect.width / 2
    const originY = rect.top + rect.height / 2
    const endRadius = Math.hypot(
      Math.max(originX, window.innerWidth - originX),
      Math.max(originY, window.innerHeight - originY),
    )

    document.documentElement.classList.add('toolia-theme-transitioning')

    const transition = transitionDocument.startViewTransition(() => {
      commitTheme(nextTheme)
    })

    transition.ready
      .then(() => {
        const animationOptions: KeyframeAnimationOptions & { pseudoElement?: string } = {
          duration: themeTransitionDuration,
          easing: themeTransitionEasing,
          fill: 'both',
          pseudoElement: '::view-transition-new(root)',
        }

        document.documentElement.animate(
          {
            clipPath: [
              `circle(0px at ${originX}px ${originY}px)`,
              `circle(${endRadius}px at ${originX}px ${originY}px)`,
            ],
          },
          animationOptions,
        )
      })
      .catch(() => undefined)

    transition.finished
      .catch(() => undefined)
      .finally(() => {
        document.documentElement.classList.remove('toolia-theme-transitioning')
      })
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
              onClick={(event) => updateTheme(option.value, event)}
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
