'use client'

import React from 'react'
import { Badge } from './Badge'
import { Button } from './Button'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { BrandFlowLines } from './BrandFlowLines'
import { copy } from '@/lib/copy'
import { trackEvent } from '@/lib/analytics'

export const HowItWorks: React.FC = () => {
  const handleDiagnosticClick = () => {
    trackEvent('cta_click', {
      cta_location: 'how_it_works',
      cta_label: 'Diagnostiquer ma boîte mail',
    })
    window.location.href = '/diagnostic'
  }

  return (
    <Section id="how" className="relative overflow-hidden py-16 sm:py-24 lg:py-32 dark:bg-[#0d1117]">
      <BrandFlowLines className="left-1/2 top-4 h-[520px] w-[126vw] -translate-x-1/2 opacity-90" />

      <div className="relative z-10 flex flex-col gap-10 md:gap-16">
        <ScrollReveal>
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.72fr] lg:items-end">
            <div>
              <Badge
                variant="primary"
                size="md"
                className="border-slate-300/80 bg-white/72 text-slate-800 shadow-sm backdrop-blur-md dark:border-white/18 dark:bg-white/8 dark:text-white"
              >
                {copy.howItWorks.setupTime}
              </Badge>
              <h2 className="font-heading mt-5 max-w-5xl text-[clamp(3.4rem,13vw,8.8rem)] font-extrabold leading-[0.84] tracking-[-0.06em] text-toolia-text [text-wrap:balance] sm:mt-7">
                {copy.howItWorks.title}
              </h2>
            </div>

            <div className="max-w-xl lg:pb-3">
              <p className="text-base leading-7 text-toolia-text-secondary md:text-lg md:leading-8">
                Une mise en place courte, des règles simples, puis une automatisation qui reste sous votre contrôle.
              </p>
              <div className="mt-6 flex flex-col items-start gap-4">
                <p className="text-sm font-semibold leading-6 text-toolia-primary dark:text-sky-200 md:text-base">
                  Vous gardez toujours le contrôle à chaque étape.
                </p>
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleDiagnosticClick}
                  className="bg-[#172554] shadow-[0_18px_48px_rgba(29,78,216,0.26)] ring-1 ring-blue-100/70 hover:bg-[#1d4ed8] dark:bg-blue-500 dark:hover:bg-blue-400"
                >
                  Diagnostiquer ma boîte mail
                </Button>
              </div>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="border-y border-toolia-border-subtle/90 bg-white/38 shadow-[0_30px_90px_rgba(22,34,74,0.055)] backdrop-blur-sm dark:border-white/10 dark:bg-slate-950/24">
            {copy.howItWorks.steps.map((step) => (
              <div
                key={step.number}
                className="grid gap-4 border-b border-toolia-border-subtle/80 px-1 py-7 last:border-b-0 sm:px-3 sm:py-8 md:grid-cols-[5.5rem_0.7fr_1fr] md:items-center md:gap-8 lg:px-6 lg:py-10 dark:border-white/10"
              >
                <div className="flex items-center gap-4 md:block">
                  <span className="font-heading block text-[3.4rem] font-extrabold leading-none tracking-[-0.08em] text-toolia-primary/18 dark:text-sky-200/18 sm:text-[4.3rem]">
                    0{step.number}
                  </span>
                  <span className="h-px flex-1 bg-toolia-border-subtle md:hidden dark:bg-white/12" />
                </div>

                <h3 className="font-heading text-2xl font-extrabold leading-tight tracking-[-0.035em] text-toolia-text sm:text-3xl">
                  {step.title}
                </h3>

                <p className="max-w-2xl text-sm leading-7 text-toolia-text-secondary sm:text-base">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </Section>
  )
}

HowItWorks.displayName = 'HowItWorks'
