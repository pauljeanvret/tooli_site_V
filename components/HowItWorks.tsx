'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Badge } from './Badge'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

export const HowItWorks: React.FC = () => {
  return (
    <Section id="how" className="bg-gradient-to-b from-toolia-bg-secondary/50 via-toolia-bg-main to-toolia-bg-secondary/45">
      <div className="flex flex-col gap-16">
        <ScrollReveal>
          <div className="flex flex-col gap-6">
            <h2 className="text-3xl font-bold text-toolia-text md:text-4xl lg:text-5xl">
              {copy.howItWorks.title}
            </h2>
            <div>
              <Badge variant="primary" size="md">
                {copy.howItWorks.setupTime}
              </Badge>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 items-stretch gap-8 md:grid-cols-2 xl:grid-cols-4">
          {copy.howItWorks.steps.map((step, idx) => (
            <ScrollReveal key={idx} delay={idx * 0.15}>
              <motion.div className="relative flex h-full flex-col gap-6" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
                <div className="flex h-full flex-col gap-4 rounded-card border border-toolia-border-subtle bg-gradient-to-br from-toolia-card to-toolia-gradient-dark/20 p-8">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-toolia-primary text-xl font-bold text-white">
                    {step.number}
                  </div>
                  <div className="flex-1">
                    <h3 className="mb-2 text-xl font-semibold text-toolia-text">{step.title}</h3>
                    <p className="text-sm leading-6 text-toolia-text-secondary">{step.description}</p>
                  </div>
                </div>

                {idx < copy.howItWorks.steps.length - 1 && (
                  <motion.div
                    className="absolute -right-10 top-1/2 hidden -translate-y-1/2 text-toolia-primary/30 xl:flex"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ArrowRight size={28} />
                  </motion.div>
                )}
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 md:hidden">
          {[...Array(Math.max(0, copy.howItWorks.steps.length - 1))].map((_, idx) => (
            <motion.div key={idx} animate={{ y: [0, 4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
              <ArrowRight size={24} className="rotate-90 text-toolia-primary/30" />
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  )
}

HowItWorks.displayName = 'HowItWorks'
