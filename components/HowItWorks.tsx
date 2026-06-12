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
    <Section id="how">
      <div className="flex flex-col gap-10 md:gap-14">
        <ScrollReveal>
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-5 text-center">
            <Badge
              variant="primary"
              size="md"
              className="shadow-sm backdrop-blur-md dark:border-white/25 dark:bg-white/12 dark:text-white"
            >
              {copy.howItWorks.setupTime}
            </Badge>
            <h2 className="text-3xl font-bold text-toolia-text md:text-4xl lg:text-5xl">
              {copy.howItWorks.title}
            </h2>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <div className="relative overflow-hidden rounded-[34px] border border-toolia-border-subtle bg-toolia-card p-5 shadow-soft dark:border-white/10 md:p-7">
            <div className="absolute inset-x-10 top-[5.9rem] hidden h-px bg-toolia-border-subtle dark:bg-white/14 md:block" />
            <motion.div
              className="absolute left-10 top-[5.9rem] hidden h-px bg-toolia-primary dark:bg-sky-300/70 md:block"
              initial={{ width: 0 }}
              whileInView={{ width: 'calc(100% - 5rem)' }}
              viewport={{ once: true, amount: 0.45 }}
              transition={{ duration: 1.15, ease: 'easeInOut' }}
            />

            <div className="grid gap-5 md:grid-cols-4">
              {copy.howItWorks.steps.map((step, idx) => {
                const Icon = icons[idx] || Mail
                return (
                  <div key={step.number} className="relative flex gap-4 md:flex-col md:gap-5">
                    <div className="relative z-10 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-toolia-primary text-white shadow-btn-primary">
                      <Icon size={21} />
                    </div>
                    {idx < copy.howItWorks.steps.length - 1 && (
                      <div className="absolute left-7 top-14 h-[calc(100%-1.5rem)] w-px bg-toolia-border-subtle md:hidden" />
                    )}
                    <div className="min-w-0 rounded-[24px] bg-toolia-bg-secondary/55 p-5 md:min-h-[220px] md:bg-transparent md:p-0">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="rounded-full border border-toolia-border-subtle bg-toolia-card px-3 py-1 text-xs font-semibold text-toolia-text-secondary">
                          Étape {step.number}
                        </span>
                        {idx < copy.howItWorks.steps.length - 1 && (
                          <ArrowRight size={18} className="hidden text-toolia-primary/45 md:block" />
                        )}
                      </div>
                      <h3 className="text-lg font-bold text-toolia-text md:text-xl">{step.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-toolia-text-secondary">{step.description}</p>
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
