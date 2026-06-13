'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Clock, Headphones, Mail, TrendingUp } from 'lucide-react'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

const iconMap = {
  TrendingUp,
  Mail,
  Clock,
  Headphones,
}

const tileClasses = [
  'lg:col-span-5 lg:row-span-2',
  'lg:col-span-4',
  'lg:col-span-3',
  'lg:col-span-7',
]

export const Stats: React.FC = () => {
  return (
    <Section id="stats" className="bg-toolia-bg-secondary/65 max-md:py-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-7 md:gap-10">
        <ScrollReveal>
          <h2 className="mx-auto max-w-4xl text-center text-[2rem] font-bold leading-tight text-toolia-text md:text-4xl lg:text-5xl">
            {copy.stats.title}
          </h2>
        </ScrollReveal>

        <div className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-2">
          {copy.stats.items.map((stat, idx) => {
            const Icon = iconMap[stat.icon as keyof typeof iconMap]
            return (
              <ScrollReveal key={stat.value} delay={idx * 0.08} className={tileClasses[idx]}>
                <motion.div
                  className={`group relative flex h-full min-h-[124px] overflow-hidden rounded-[24px] border border-toolia-border-subtle bg-toolia-card p-4 shadow-soft md:min-h-[150px] md:rounded-[30px] md:p-6 ${idx === 0 ? 'lg:min-h-[318px] lg:p-8' : ''}`}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-toolia-primary/7 transition group-hover:scale-125" />
                  <div className="relative z-10 flex w-full flex-col justify-between gap-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-toolia-bg-secondary text-toolia-primary md:h-12 md:w-12">
                      <Icon size={idx === 0 ? 30 : 24} />
                    </div>
                    <div>
                      <p className={`${idx === 0 ? 'text-4xl md:text-6xl' : 'text-3xl md:text-4xl'} font-bold leading-none text-toolia-text`}>
                        {stat.value}
                      </p>
                      <p className="mt-2 text-sm leading-5 text-toolia-text-secondary">
                        {stat.label}
                      </p>
                    </div>
                  </div>
                </motion.div>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

Stats.displayName = 'Stats'
