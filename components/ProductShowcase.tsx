'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { Badge } from './Badge'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

export const ProductShowcase: React.FC = () => {
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null)

  const togglePlan = (idx: number) => {
    setExpandedPlan(expandedPlan === idx ? null : idx)
  }

  return (
    <Section id="pricing" className="bg-gradient-to-b from-toolia-bg-secondary/40 via-toolia-bg-main to-toolia-bg-secondary/50">
      <div className="flex flex-col gap-16">
        {/* Title */}
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-toolia-text text-center max-w-3xl mx-auto">
            {copy.pricing.title}
          </h2>
        </ScrollReveal>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-6">
          {copy.pricing.plans.map((plan, idx) => (
            <ScrollReveal key={idx} delay={idx * 0.15}>
              <motion.div
                whileHover={{ y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <Card
                  className={`h-full flex flex-col gap-4 ${
                    plan.featured
                      ? 'lg:scale-105 border-toolia-primary shadow-lg ring-2 ring-toolia-primary/10'
                      : ''
                  }`}
                >
                  {/* Header */}
                  <div>
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <h3 className="text-2xl font-bold text-toolia-text">{plan.name}</h3>
                      {plan.featured && <Badge variant="primary" size="sm">Populaire</Badge>}
                    </div>
                    <p className="text-sm text-toolia-text-secondary">{plan.description}</p>
                  </div>

                  {/* Features */}
                  <div className="flex-1 space-y-3 py-2">
                    {plan.features.map((feature, featureIdx) => (
                      <div key={featureIdx} className="flex items-start gap-3">
                        <Check size={20} className="text-toolia-success flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-toolia-text">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Expandable Pricing */}
                  <AnimatePresence>
                    {expandedPlan === idx && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-toolia-primary/5 rounded-lg p-4 space-y-3 mb-4">
                          <div>
                            <span className="text-xs text-toolia-text-secondary font-medium block mb-1">{plan.setupLabel}</span>
                            <span className="text-lg font-bold text-toolia-text">{plan.setup}</span>
                          </div>
                          <div>
                            <span className="text-xs text-toolia-text-secondary font-medium block mb-1">Abonnement</span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-toolia-text">{plan.price}</span>
                              <span className="text-toolia-text-secondary">{plan.period}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* CTA Button */}
                  <Button
                    variant={plan.featured ? 'primary' : 'outline'}
                    size="md"
                    className="w-full"
                    onClick={() => togglePlan(idx)}
                  >
                    {plan.cta}
                  </Button>
                </Card>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        {/* Disclaimer */}
        <motion.div
          className="text-center max-w-2xl mx-auto"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
        >
          <p className="text-sm text-toolia-text-secondary italic">
            {copy.pricing.disclaimer}
          </p>
        </motion.div>
      </div>
    </Section>
  )
}

ProductShowcase.displayName = 'ProductShowcase'
