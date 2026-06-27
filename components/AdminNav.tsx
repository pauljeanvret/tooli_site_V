'use client'

import Link from 'next/link'

type AdminNavProps = {
  active: 'diagnostics' | 'finance'
}

const items = [
  { id: 'diagnostics', href: '/admin/diagnostics', label: 'Diagnostics' },
  { id: 'finance', href: '/admin/finance', label: 'Finance' },
] as const

export function AdminNav({ active }: AdminNavProps) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
      {items.map((item) => {
        const isActive = item.id === active
        if (isActive) {
          return (
            <span key={item.id} className="rounded-full bg-toolia-primary px-4 py-2 text-white">
              {item.label}
            </span>
          )
        }

        return (
          <Link
            key={item.id}
            href={item.href}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-slate-700 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
          >
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
