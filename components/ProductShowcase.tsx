'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { Badge } from './Badge'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'
import { getTooliaClientState } from '@/lib/saas/client-navigation'

const audiences = [
  'Indépendants avec une boîte Gmail à reprendre en main.',
  'Professionnels avec un flux régulier et des alertes utiles.',
  'Volumes élevés, suivi plus rapide et personnalisation avancée.',
]

export const ProductShowcase: React.FC = () => {
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

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-3">
          {copy.pricing.plans.map((plan, idx) => (
            <ScrollReveal key={idx} delay={idx * 0.15}>
              <motion.div className="h-full" whileHover={{ y: -4 }} transition={{ duration: 0.22 }}>
                <Card
                  className={`group relative flex h-full flex-col gap-5 overflow-hidden ${
                    plan.featured ? 'border-toolia-primary shadow-lg ring-2 ring-toolia-primary/10 lg:scale-[1.035]' : ''
                  }`}
                >
                  {plan.featured && (
                    <div className="pointer-events-none absolute inset-0 opacity-70">
                      <div className="toolia-plan-glow absolute -left-1/3 top-0 h-px w-2/3 bg-gradient-to-r from-transparent via-toolia-info to-transparent" />
                    </div>
                  )}
                  <div>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="text-2xl font-bold text-toolia-text">{plan.name}</h3>
                      {plan.featured && <Badge variant="primary" size="sm">Populaire</Badge>}
                    </div>
                    <p className="text-sm leading-6 text-toolia-text-secondary">{plan.description}</p>
                  </div>

                  <div className="rounded-2xl border border-toolia-border-subtle bg-toolia-bg-secondary/70 p-4">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-toolia-text-muted">Pour qui</span>
                    <p className="mt-2 text-sm font-semibold leading-6 text-toolia-text">
                      {audiences[idx]}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-toolia-primary/5 p-4">
                    <div>
                      <span className="mb-1 block text-xs font-medium text-toolia-text-secondary">{plan.setupLabel}</span>
                      <span className="text-lg font-bold text-toolia-text">{plan.setup}</span>
                    </div>
                    <div className="mt-3">
                      <span className="mb-1 block text-xs font-medium text-toolia-text-secondary">Abonnement</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-toolia-text">{plan.price}</span>
                        <span className="text-toolia-text-secondary">{plan.period}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 py-2">
                    {plan.features.map((feature, featureIdx) => (
                      <motion.div
                        key={featureIdx}
                        className="flex items-start gap-3"
                        initial={{ opacity: 0, x: -4 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.22, delay: featureIdx * 0.025 }}
                      >
                        <Check size={19} className="mt-0.5 flex-shrink-0 text-toolia-success" />
                        <span className="text-sm text-toolia-text">{feature}</span>
                      </motion.div>
                    ))}
                  </div>

                  <Button
                    variant={plan.featured ? 'primary' : 'outline'}
                    size="md"
                    className="w-full"
                    onClick={() => void startWithPlan(idx)}
                  >
                    Commencer avec cette offre
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
