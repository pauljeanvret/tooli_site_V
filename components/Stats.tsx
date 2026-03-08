'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Mail, Clock, Headphones } from 'lucide-react'
import { Card } from './Card'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

const iconMap = {
  TrendingUp,
  Mail,
  Clock,
  Headphones,
}

export const Stats: React.FC = () => {
  return (
    <Section
      id="stats"
      className="bg-gradient-to-b from-toolia-bg-secondary/45 via-toolia-bg-main to-toolia-bg-secondary/50"
    >
      <div className="flex flex-col gap-16">
        {/* Title */}
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-toolia-text text-center">
            {copy.stats.title}
          </h2>
        </ScrollReveal>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {copy.stats.items.map((stat, idx) => {
            const Icon = iconMap[stat.icon as keyof typeof iconMap]
            return (
              <ScrollReveal key={idx} delay={idx * 0.1}>
                <motion.div
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="text-center flex flex-col items-center gap-4">
                    <Icon size={32} className="text-toolia-primary" />
                    <div>
                      <p className="text-3xl md:text-4xl font-bold text-toolia-text">
                        {stat.value}
                      </p>
                      <p className="text-sm text-toolia-text-secondary mt-1">
                        {stat.label}
                      </p>
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

Stats.displayName = 'Stats'
