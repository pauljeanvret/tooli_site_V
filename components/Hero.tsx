'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from './Button'
import { AutomationMotionStrip } from './AutomationMotionStrip'
import { copy } from '@/lib/copy'
import { getTooliaClientState, routeToTooliaStart } from '@/lib/saas/client-navigation'

const heroGroup = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
}

const heroItem = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
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
    if (target) target.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <section id="hero" className="relative isolate flex min-h-[96svh] overflow-hidden bg-toolia-bg-main pt-18 sm:min-h-[90svh]">
      {/* Place the calm desk hero video at public/videos/hero-desk.mp4 */}
      {/* Place the hero poster at public/videos/hero-desk-poster.jpg */}
      {/* Optional: generate hero-desk-loop.mp4 for seamless ping-pong loop */}
      <video
        className="hero-video absolute inset-0 h-full w-full scale-[1.035] object-cover object-[55%_center] brightness-[1.08] saturate-[0.98] transition duration-500 dark:brightness-[0.76] dark:contrast-[1.04] dark:saturate-[0.92] sm:object-center sm:brightness-[1.02] sm:saturate-[0.95] sm:dark:brightness-[0.55] sm:dark:contrast-[1.08] sm:dark:saturate-[0.85]"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/videos/hero-desk-poster.jpg"
        aria-hidden="true"
      >
        <source src="/videos/hero-desk-loop.mp4" type="video/mp4" />
        <source src="/videos/hero-desk.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-b from-white/36 via-white/12 to-white/42 dark:from-[#030712]/36 dark:via-[#06101f]/20 dark:to-[#030712]/46 sm:from-white/60 sm:via-white/24 sm:to-white/68 sm:dark:from-[#030712]/70 sm:dark:via-[#06101f]/48 sm:dark:to-[#030712]/78" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.54),rgba(255,255,255,0.2)_42%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(3,7,18,0.58),rgba(3,7,18,0.28)_46%,transparent_72%)] sm:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.26),transparent_55%)] sm:dark:bg-[radial-gradient(ellipse_at_center,rgba(3,7,18,0.62),rgba(3,7,18,0.34)_42%,transparent_68%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.22),rgba(255,255,255,0.04)_44%,transparent_68%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.3),transparent_60%)] sm:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.34),rgba(255,255,255,0.08)_38%,transparent_64%)] sm:dark:bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.44),transparent_58%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-toolia-bg-main to-transparent sm:h-36" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-5 pb-32 pt-12 text-center sm:px-6 sm:py-16 md:px-8 lg:px-10">
        <motion.div
          className="mx-auto flex max-w-6xl flex-col items-center"
          initial="hidden"
          animate="visible"
          variants={heroGroup}
        >
          <motion.h1
            className="font-heading mx-auto max-w-[22rem] text-center text-[clamp(3.2rem,14vw,5.4rem)] font-extrabold leading-[0.9] tracking-[-0.055em] text-slate-950 drop-shadow-[0_1px_18px_rgba(255,255,255,0.34)] [text-wrap:balance] dark:text-white dark:drop-shadow-[0_8px_34px_rgba(0,0,0,0.58)] sm:max-w-[1100px] sm:text-[clamp(4rem,10vw,9.5rem)]"
            variants={heroItem}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="block">Votre boîte mail</span>
            <span className="block">se gère toute seule.</span>
          </motion.h1>

          <motion.div
            className="mt-4 h-[3px] w-24 rounded-full bg-toolia-primary/70 shadow-[0_0_24px_rgba(31,42,77,0.26)] dark:bg-white/60 dark:shadow-[0_0_24px_rgba(147,197,253,0.32)] sm:mt-5 sm:w-28"
            variants={heroItem}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.p
            className="mt-4 max-w-[22rem] text-base leading-7 text-slate-800 drop-shadow-[0_2px_12px_rgba(255,255,255,0.4)] dark:text-white/90 dark:drop-shadow-[0_2px_14px_rgba(0,0,0,0.48)] sm:mt-5 sm:max-w-3xl sm:text-[clamp(1.1rem,1.45vw,1.55rem)] sm:leading-relaxed sm:text-toolia-text-secondary sm:drop-shadow-none sm:dark:text-white/80 sm:dark:drop-shadow-none"
            variants={heroItem}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {copy.hero.subtitle}
          </motion.p>

          <motion.div
            className="mt-7 flex w-full max-w-xs flex-col items-center justify-center gap-3 sm:mt-8 sm:w-auto sm:max-w-none sm:flex-row"
            variants={heroItem}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                void routeToTooliaStart()
              }}
              className="w-full sm:w-auto"
            >
              {primaryCta}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => handleSmoothScroll('#how')} className="w-full sm:w-auto">
              {copy.hero.cta2}
            </Button>
          </motion.div>

          <motion.p
            className="mt-4 text-xs font-medium text-slate-700 drop-shadow-[0_2px_10px_rgba(255,255,255,0.36)] dark:text-white/75 dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.46)] sm:mt-6 sm:font-normal sm:text-toolia-text-secondary sm:drop-shadow-none sm:dark:text-toolia-text-secondary"
            variants={heroItem}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            {copy.hero.subCta}
          </motion.p>
        </motion.div>
      </div>

      <AutomationMotionStrip className="absolute bottom-4 z-30 sm:bottom-8" />
    </section>
  )
}

Hero.displayName = 'Hero'

