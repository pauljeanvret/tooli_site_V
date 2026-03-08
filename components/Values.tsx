'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Zap, Shield, Lock } from 'lucide-react'
import { Card } from './Card'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

const iconMap = {
  Zap,
  Shield,
  Lock,
}

export const Values: React.FC = () => {
  return (
    <Section id="values" className="bg-gradient-to-b from-toolia-bg-secondary/50 via-toolia-bg-main to-toolia-bg-secondary/40">
      <div className="flex flex-col gap-16">
        {/* Title */}
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-toolia-text text-center max-w-2xl mx-auto">
            {copy.values.title}
          </h2>
        </ScrollReveal>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {copy.values.items.map((item, idx) => {
            const Icon = iconMap[item.icon as keyof typeof iconMap]
            return (
              <ScrollReveal key={idx} delay={idx * 0.1}>
                <motion.div
                  whileHover={{ y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="h-full flex flex-col gap-4 hover:border-toolia-primary hover:shadow-lg">
                    <div className="w-12 h-12 rounded-full bg-toolia-primary/15 flex items-center justify-center">
                      <Icon size={24} className="text-toolia-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-toolia-text mb-2">{item.title}</h3>
                      <p className="text-toolia-text-secondary text-sm leading-relaxed">{item.description}</p>
                    </div>
                  </Card>
                </motion.div>
              </ScrollReveal>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

Values.displayName = 'Values'
