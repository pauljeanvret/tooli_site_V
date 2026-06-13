'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Mail, RotateCw, SlidersHorizontal } from 'lucide-react'
import { Badge } from './Badge'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

const icons = [Mail, SlidersHorizontal, RotateCw, CheckCircle2]

export const HowItWorks: React.FC = () => {
  return (
    <Section id="how" className="py-10 sm:py-16 md:py-24 lg:py-28">
      <div className="flex flex-col gap-7 md:gap-14">
        <ScrollReveal>
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center md:gap-5">
            <Badge
              variant="primary"
              size="md"
              className="shadow-sm backdrop-blur-md dark:border-white/25 dark:bg-white/12 dark:text-white"
            >
              {copy.howItWorks.setupTime}
            </Badge>
            <h2 className="text-[2rem] font-bold leading-tight text-toolia-text md:text-4xl lg:text-5xl">
              {copy.howItWorks.title}
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[26px] border border-toolia-border-subtle bg-toolia-card p-3 shadow-soft dark:border-white/10 sm:p-5 md:rounded-[34px] md:p-7">
            <div className="absolute inset-x-10 top-[5.9rem] hidden h-px bg-toolia-border-subtle dark:bg-white/14 md:block" />
            <motion.div
              className="absolute left-10 top-[5.9rem] hidden h-px bg-toolia-primary dark:bg-sky-300/70 md:block"
              initial={{ width: 0 }}
              whileInView={{ width: 'calc(100% - 5rem)' }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 1.15, ease: 'easeInOut' }}
            />

            <div className="grid gap-3 md:grid-cols-4 md:gap-5">
              {copy.howItWorks.steps.map((step, idx) => {
                const Icon = icons[idx] || Mail
                return (
                  <div key={step.number} className="relative flex gap-3 md:flex-col md:gap-5">
                    <div className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-toolia-primary text-white shadow-btn-primary md:h-14 md:w-14">
                      <Icon size={18} className="md:h-[21px] md:w-[21px]" />
                    </div>
                    {idx < copy.howItWorks.steps.length - 1 && (
                      <div className="absolute left-5 top-10 h-[calc(100%-0.5rem)] w-px bg-toolia-border-subtle md:hidden" />
                    )}
                    <div className="min-w-0 flex-1 rounded-[20px] bg-toolia-bg-secondary/55 p-4 md:min-h-[220px] md:bg-transparent md:p-0">
                      <div className="mb-2 flex items-center justify-between gap-3 md:mb-3">
                        <span className="rounded-full border border-toolia-border-subtle bg-toolia-card px-2.5 py-1 text-[0.7rem] font-semibold text-toolia-text-secondary md:px-3 md:text-xs">
                          Étape {step.number}
                        </span>
                        {idx < copy.howItWorks.steps.length - 1 && (
                          <ArrowRight size={18} className="hidden text-toolia-primary/45 md:block" />
                        )}
                      </div>
                      <h3 className="text-base font-bold text-toolia-text md:text-xl">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-toolia-text-secondary md:mt-3">{step.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </Section>
  )
}

HowItWorks.displayName = 'HowItWorks'
