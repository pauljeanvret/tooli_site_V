'use client'

import React from 'react'
import { CheckCircle2, Mail, Pause, PencilLine, ShieldCheck, Tag } from 'lucide-react'
import { Button } from './Button'
import { Section } from './Section'
import { trackEvent } from '@/lib/analytics'

const dashboardStats = [
  { label: 'Gmail', value: 'Connecté', icon: Mail },
  { label: 'Automatisation', value: 'Active', icon: CheckCircle2 },
  { label: 'Brouillons', value: '12 prêts', icon: PencilLine },
  { label: 'Contrôle', value: 'Validation requise', icon: ShieldCheck },
]

const rules = ['Clients', 'Urgences', 'Factures', 'Prospects']

export function ProductDemoVideo() {
  return (
    <Section id="demo" className="bg-toolia-bg-secondary/70 pb-12 pt-7 sm:pb-14 sm:pt-8 md:pb-16 md:pt-10 lg:pb-20 lg:pt-12 dark:bg-[#101827]">
      <div className="grid gap-7 lg:grid-cols-[0.86fr_1.14fr] lg:items-center lg:gap-10">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-toolia-info">Espace Toolia</p>
          <h2 className="font-heading mt-3 max-w-2xl text-[2rem] font-extrabold leading-tight tracking-[-0.035em] text-toolia-text md:mt-4 md:text-4xl lg:text-5xl">
            Un espace simple pour garder le contrôle.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-7 text-toolia-text-secondary md:mt-5 md:text-base">
            Suivez vos règles, vos brouillons, vos validations et l’état de votre automatisation depuis un dashboard clair.
          </p>
          <div className="mt-5 md:mt-6">
            <Button
              variant="primary"
              size="md"
              className="w-full max-w-xs bg-[#172554] shadow-[0_18px_48px_rgba(29,78,216,0.26)] ring-1 ring-blue-100/70 hover:bg-[#1d4ed8] dark:bg-blue-500 dark:hover:bg-blue-400 md:w-auto"
              onClick={() => {
                trackEvent('cta_click', {
                  cta_location: 'dashboard',
                  cta_label: 'Diagnostiquer ma boîte mail',
                })
                window.location.href = '/diagnostic'
              }}
            >
              Diagnostiquer ma boîte mail
            </Button>
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-4 rounded-[40px] bg-toolia-info/10 blur-3xl dark:bg-blue-400/10" />
          <div className="relative overflow-hidden rounded-[26px] border border-toolia-border-subtle bg-toolia-card p-2 shadow-soft dark:border-white/10 dark:bg-slate-900/82 md:rounded-[32px] md:p-3">
            <div className="rounded-[22px] border border-toolia-border-subtle bg-toolia-bg-main p-4 dark:border-white/10 dark:bg-slate-950/54 md:rounded-[26px] md:p-6">
              <div className="mb-4 flex flex-col gap-3 border-b border-toolia-border-subtle pb-4 sm:flex-row sm:items-center sm:justify-between md:mb-5 md:pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-toolia-text-muted">Dashboard</p>
                  <h3 className="mt-1 text-lg font-bold text-toolia-text md:text-xl">Tableau de bord Toolia</h3>
                </div>
                <span className="inline-flex w-fit rounded-full border border-toolia-success/30 bg-toolia-success/10 px-3 py-1 text-xs font-semibold text-toolia-success">
                  Gmail connecté
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {dashboardStats.map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className="rounded-[18px] border border-toolia-border-subtle bg-toolia-card p-3 md:rounded-[22px] md:p-4">
                      <Icon size={18} className="text-toolia-info" />
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-toolia-text-muted md:mt-3">{item.label}</p>
                      <p className="mt-1 text-base font-bold text-toolia-text">{item.value}</p>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 rounded-[20px] border border-toolia-border-subtle bg-toolia-card p-3 md:mt-4 md:rounded-[24px] md:p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-toolia-text">Règles actives</p>
                    <p className="mt-1 text-xs text-toolia-text-secondary">Labels, brouillons et validations restent pilotables.</p>
                  </div>
                  <Pause size={18} className="text-toolia-text-muted" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 md:mt-4">
                  {rules.map((rule) => (
                    <span key={rule} className="inline-flex items-center gap-2 rounded-full border border-toolia-border-subtle bg-toolia-bg-secondary px-3 py-1.5 text-xs font-semibold text-toolia-text-secondary">
                      <Tag size={13} className="text-toolia-info" />
                      {rule}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Section>
  )
}
