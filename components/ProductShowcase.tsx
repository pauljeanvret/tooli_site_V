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
import { getTooliaClientState } from '@/lib/saas/client-navigation'

export const ProductShowcase: React.FC = () => {
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null)

  const togglePlan = (idx: number) => {
    setExpandedPlan(expandedPlan === idx ? null : idx)
  }

  const startWithPlan = async (idx: number) => {
    const state = await getTooliaClientState()
    if (state.isLoggedIn && state.hasAutomation) {
      window.location.href = '/dashboard'
      return
    }

    const plans = [
      { id: 'starter', name: 'Starter', maxLabels: 5 },
      { id: 'pro', name: 'Pro', maxLabels: 12 },
      { id: 'premium', name: 'Premium', maxLabels: 25 },
    ]
    const plan = plans[idx]

    window.localStorage.setItem(
      'toolia_selected_plan',
      JSON.stringify({
        ...plan,
        price: copy.pricing.plans[idx].price,
        setup: copy.pricing.plans[idx].setup,
        description: copy.pricing.plans[idx].description,
        features: copy.pricing.plans[idx].features,
        paid: false,
      }),
    )
    window.location.href = state.isLoggedIn ? `/pricing?plan=${plan.id}` : `/signup?plan=${plan.id}`
  }

  return (
    <Section id="pricing">
      <div className="flex flex-col gap-10 md:gap-14">
        <ScrollReveal>
          <div className="mx-auto flex max-w-4xl flex-col gap-4 text-center">
            <h2 className="text-3xl font-bold text-toolia-text md:text-4xl lg:text-5xl">
              {copy.pricing.title}
            </h2>
            <p className="text-sm leading-6 text-toolia-text-secondary md:text-base">
              {copy.pricing.disclaimer}
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3 lg:gap-6">
          {copy.pricing.plans.map((plan, idx) => (
            <ScrollReveal key={idx} delay={idx * 0.15}>
              <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2 }}>
                <Card
                  className={`flex h-full flex-col gap-4 ${
                    plan.featured ? 'border-toolia-primary shadow-lg ring-2 ring-toolia-primary/10 lg:scale-105' : ''
                  }`}
                >
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-2xl font-bold text-toolia-text">{plan.name}</h3>
                      {plan.featured && <Badge variant="primary" size="sm">Populaire</Badge>}
                    </div>
                    <p className="text-sm leading-6 text-toolia-text-secondary">{plan.description}</p>
                  </div>

                  <div className="flex-1 space-y-3 py-2">
                    {plan.features.map((feature, featureIdx) => (
                      <div key={featureIdx} className="flex items-start gap-3">
                        <Check size={20} className="mt-0.5 flex-shrink-0 text-toolia-success" />
                        <span className="text-sm text-toolia-text">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <AnimatePresence>
                    {expandedPlan === idx && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                        <div className="mb-4 space-y-3 rounded-lg bg-toolia-primary/5 p-4">
                          <div>
                            <span className="mb-1 block text-xs font-medium text-toolia-text-secondary">{plan.setupLabel}</span>
                            <span className="text-lg font-bold text-toolia-text">{plan.setup}</span>
                          </div>
                          <div>
                            <span className="mb-1 block text-xs font-medium text-toolia-text-secondary">Abonnement</span>
                            <div className="flex items-baseline gap-2">
                              <span className="text-lg font-bold text-toolia-text">{plan.price}</span>
                              <span className="text-toolia-text-secondary">{plan.period}</span>
                            </div>
                          </div>
                          <Button
                            variant={plan.featured ? 'primary' : 'outline'}
                            size="md"
                            className="w-full"
                            onClick={() => void startWithPlan(idx)}
                          >
                            Commencer avec cette offre
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <Button
                    variant={plan.featured ? 'primary' : 'outline'}
                    size="md"
                    className="w-full"
                    onClick={() => togglePlan(idx)}
                  >
                    Voir les détails du pack
                  </Button>
                </Card>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>

        <motion.p
          className="mx-auto max-w-3xl text-center text-xs leading-6 text-toolia-text-secondary"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          viewport={{ once: true }}
        >
          Les paiements et changements d’offre passent par Stripe. Votre plan n’est activé qu’après confirmation du paiement.
        </motion.p>
      </div>
    </Section>
  )
}

ProductShowcase.displayName = 'ProductShowcase'
