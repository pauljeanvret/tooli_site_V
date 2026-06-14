'use client'

import React from 'react'
import { cn } from '@/lib/utils'

const firstRow = [
  'Email reçu',
  'Label Clients',
  'Brouillon préparé',
  'Urgence détectée',
  'Facture classée',
  'Validation humaine',
  'Aucun envoi automatique',
  'Gmail connecté',
  'Réponse prête à relire',
  'Priorité détectée',
  'Contrôle conservé',
  'Règles personnalisées',
]

const secondRow = [
  'Prospect identifié',
  'À vérifier',
  'Label Urgences',
  'Brouillon dans Gmail',
  'Contrôle humain',
  'Boîte mail apaisée',
  'Automation en pause possible',
  'Labels personnalisés',
  'Facture reconnue',
  'Réponse à valider',
  'Aucun envoi automatique',
]

function MotionRow({ items, reverse = false, compact = false }: { items: string[]; reverse?: boolean; compact?: boolean }) {
  const repeated = [...items, ...items, ...items, ...items]

  return (
    <div className="overflow-hidden">
      <div className={cn('flex w-max min-w-[220vw] flex-nowrap py-1', compact ? 'gap-2' : 'gap-3', reverse ? 'toolia-marquee-reverse' : 'toolia-marquee')}>
        {repeated.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className={cn(
              'inline-flex whitespace-nowrap rounded-full border border-slate-200/90 bg-white/90 font-semibold text-slate-900 shadow-[0_8px_28px_rgba(15,23,42,0.1)] backdrop-blur-lg dark:border-white/20 dark:bg-slate-900/78 dark:text-white/90 dark:shadow-[0_10px_30px_rgba(0,0,0,0.24)]',
              compact
                ? 'border-white/80 bg-white/90 px-3 py-1.5 text-[0.68rem] text-slate-950 shadow-sm dark:border-white/80 dark:bg-white/90 dark:text-slate-950'
                : 'px-4 py-2 text-xs',
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

export function AutomationMotionStrip({ className = '' }: { className?: string }) {
  const mobileProofChips = ['Email reçu', 'Brouillon préparé', 'Validation humaine', 'Aucun envoi automatique', 'Label ajouté', 'Gmail connecté']

  return (
    <div className={cn('pointer-events-none relative left-1/2 w-screen -translate-x-1/2 overflow-hidden px-0', className)}>
      <div className="relative border-y border-slate-200/80 bg-white/70 py-1.5 shadow-[0_18px_70px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/20 dark:bg-slate-950/60 dark:shadow-[0_18px_80px_rgba(0,0,0,0.42)] sm:py-3">
        <div className="overflow-hidden sm:hidden [mask-image:linear-gradient(to_right,transparent_0%,black_4%,black_96%,transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0%,black_4%,black_96%,transparent_100%)]">
          <MotionRow items={mobileProofChips} compact />
        </div>
        <div className="hidden sm:block">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-white/95 via-white/54 to-transparent dark:from-[#030712]/95 dark:via-[#06101f]/60 sm:w-40" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-white/95 via-white/54 to-transparent dark:from-[#030712]/95 dark:via-[#06101f]/60 sm:w-40" />
          <MotionRow items={firstRow} />
          <MotionRow items={secondRow} reverse />
        </div>
      </div>
    </div>
  )
}

