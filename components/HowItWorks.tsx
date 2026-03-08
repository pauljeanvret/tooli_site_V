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
        {/* Title */}
        <ScrollReveal>
          <div className="flex flex-col gap-6">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-toolia-text">
              {copy.howItWorks.title}
            </h2>
            <div>
              <Badge variant="primary" size="md">
                ⏱️ {copy.howItWorks.setupTime}
              </Badge>
            </div>
          </div>
        </ScrollReveal>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {copy.howItWorks.steps.map((step, idx) => (
            <ScrollReveal key={idx} delay={idx * 0.15}>
              <motion.div
                className="relative flex flex-col gap-6"
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                {/* Step Card */}
                <div className="bg-gradient-to-br from-toolia-card to-toolia-gradient-dark/20 rounded-card border border-toolia-border-subtle p-8 flex flex-col gap-4 h-full">
                  {/* Number */}
                  <div className="w-14 h-14 rounded-full bg-toolia-primary flex items-center justify-center text-xl font-bold text-white">
                    {step.number}
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-toolia-text mb-2">{step.title}</h3>
                    <p className="text-toolia-text-secondary text-sm">{step.description}</p>
                  </div>
                </div>

                {/* Arrow */}
                {idx < copy.howItWorks.steps.length - 1 && (
                  <motion.div
                    className="hidden md:flex absolute -right-16 top-1/2 -translate-y-1/2 text-toolia-primary/30"
                    animate={{ x: [0, 4, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <ArrowRight size={32} />
                  </motion.div>
                )}
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        {/* Mobile Arrows */}
        <div className="md:hidden flex flex-col items-center gap-4">
          {[...Array(2)].map((_, idx) => (
            <motion.div
              key={idx}
              animate={{ y: [0, 4, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <ArrowRight size={24} className="text-toolia-primary/30 rotate-90" />
            </motion.div>
          ))}
        </div>
      </div>
    </Section>
  )
}

HowItWorks.displayName = 'HowItWorks'
