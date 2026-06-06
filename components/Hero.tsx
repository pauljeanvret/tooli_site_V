'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, FileText, Mail, Tag } from 'lucide-react'
import { Button } from './Button'
import { ScrollReveal } from './ScrollReveal'
import { Glow } from './Glow'
import { copy } from '@/lib/copy'
import { getTooliaClientState, routeToTooliaStart } from '@/lib/saas/client-navigation'

const productSteps = [
  {
    icon: Mail,
    label: 'Email reçu',
    detail: 'Demande urgente client',
    tone: 'info',
  },
  {
    icon: Tag,
    label: 'Label ajouté',
    detail: 'Urgence',
    tone: 'warning',
  },
  {
    icon: FileText,
    label: 'Brouillon préparé',
    detail: 'Réponse prête dans Gmail',
    tone: 'info',
  },
  {
    icon: CheckCircle2,
    label: 'Vous validez',
    detail: 'Aucun envoi automatique',
    tone: 'success',
  },
]

const chipStyles = {
  info: 'border-toolia-info/35 bg-toolia-info/10 text-toolia-info',
  warning: 'border-toolia-warning/35 bg-toolia-warning/10 text-toolia-warning',
  success: 'border-toolia-success/35 bg-toolia-success/10 text-toolia-success',
}

export const Hero: React.FC = () => {
  const [primaryCta, setPrimaryCta] = React.useState(copy.hero.cta1)

  React.useEffect(() => {
    let active = true

    void getTooliaClientState().then((state) => {
      if (active) setPrimaryCta(state.ctaLabel)
    })

    return () => {
      active = false
    }
  }, [])

  const handleSmoothScroll = (href: string) => {
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <div id="hero" className="relative overflow-hidden bg-gradient-to-b from-toolia-bg-main via-toolia-bg-main to-toolia-bg-secondary/60 pb-20 pt-32 md:pt-40 lg:pb-0">
      <Glow className="top-20 -left-20 h-80 w-80 md:h-96 md:w-96 lg:h-full lg:w-full 2xl:h-screen 2xl:w-screen" color="primary" blur="lg" />
      <Glow className="bottom-40 -right-20 h-96 w-96 md:h-full md:w-full lg:h-screen lg:w-screen 2xl:h-full 2xl:w-full" color="primary" blur="lg" />

      <div className="relative z-10 mx-auto grid min-h-[calc(100vh-200px)] max-w-layout grid-cols-1 items-center gap-10 px-4 sm:px-6 md:gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(520px,1.1fr)] lg:gap-16 lg:px-10 3xl:max-w-[1560px]">
        <ScrollReveal className="flex max-w-3xl flex-col gap-6 md:gap-8">
          <motion.h1
            className="text-4xl font-bold leading-tight text-toolia-text sm:text-5xl md:text-5xl lg:text-6xl 2xl:text-7xl 3xl:text-8xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {copy.hero.title}
          </motion.h1>

          <motion.p
            className="max-w-2xl text-lg leading-relaxed text-toolia-text-secondary md:text-xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {copy.hero.subtitle}
          </motion.p>

          <motion.div
            className="flex flex-col gap-4 md:flex-row md:gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {copy.hero.proofs.map((proof, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-toolia-text-secondary">
                <div className="h-1.5 w-1.5 rounded-full bg-toolia-primary" />
                {proof}
              </div>
            ))}
          </motion.div>

          <motion.div
            className="flex flex-col gap-4 pt-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                void routeToTooliaStart()
              }}
              className="sm:w-auto"
            >
              {primaryCta}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => handleSmoothScroll('#how')} className="sm:w-auto">
              {copy.hero.cta2}
            </Button>
          </motion.div>

          <motion.p
            className="text-xs text-toolia-text-secondary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {copy.hero.subCta}
          </motion.p>
        </ScrollReveal>

        <motion.div
          className="relative mx-auto w-full max-w-2xl"
          initial={{ opacity: 0, scale: 0.96, y: 18 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.2 }}
        >
          <div className="absolute inset-8 rounded-[32px] bg-toolia-info/10 blur-3xl" />
          <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-toolia-card/95 p-5 shadow-2xl backdrop-blur">
            <div className="mb-5 flex flex-col gap-3 border-b border-toolia-border-subtle pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-toolia-info">Démo produit</p>
                <h2 className="mt-2 text-xl font-bold text-toolia-text">Un email arrive, Toolia prépare le reste.</h2>
              </div>
              <span className="inline-flex w-fit rounded-full border border-toolia-success/35 bg-toolia-success/10 px-3 py-1 text-xs font-semibold text-toolia-success">
                Contrôle humain
              </span>
            </div>

            <div className="rounded-2xl border border-toolia-border-subtle bg-toolia-bg-secondary/70 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-toolia-info/15 text-toolia-info">
                  <Mail size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-toolia-text">Marc Dubois</p>
                    <p className="text-xs text-toolia-text-muted">09:12</p>
                  </div>
                  <p className="mt-2 text-lg font-bold text-toolia-text">Demande urgente client</p>
                  <p className="mt-2 text-sm leading-6 text-toolia-text-secondary">
                    Bonjour, pouvez-vous me confirmer rapidement le délai de livraison et les prochaines étapes ?
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-4">
              {productSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <motion.div
                    key={step.label}
                    className="rounded-2xl border border-toolia-border-subtle bg-toolia-bg-main/55 p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.35 + index * 0.12 }}
                  >
                    <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full border ${chipStyles[step.tone as keyof typeof chipStyles]}`}>
                      <Icon size={17} />
                    </div>
                    <p className="text-sm font-semibold text-toolia-text">{step.label}</p>
                    <p className="mt-1 text-xs leading-5 text-toolia-text-secondary">{step.detail}</p>
                  </motion.div>
                )
              })}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-toolia-warning/30 bg-toolia-warning/10 p-3">
                <p className="text-xs text-toolia-text-secondary">Label</p>
                <p className="mt-1 text-sm font-bold text-toolia-warning">Urgence</p>
              </div>
              <div className="rounded-2xl border border-toolia-info/30 bg-toolia-info/10 p-3">
                <p className="text-xs text-toolia-text-secondary">Brouillon</p>
                <p className="mt-1 text-sm font-bold text-toolia-info">Prêt à relire</p>
              </div>
              <div className="rounded-2xl border border-toolia-success/30 bg-toolia-success/10 p-3">
                <p className="text-xs text-toolia-text-secondary">Envoi</p>
                <p className="mt-1 text-sm font-bold text-toolia-success">Validation requise</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
