'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from './Button'
import { copy } from '@/lib/copy'
import { getTooliaClientState, routeToTooliaStart } from '@/lib/saas/client-navigation'
import { trackEvent } from '@/lib/analytics'

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
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const [secondaryCta, setSecondaryCta] = React.useState('Automatiser ma boîte Gmail')

  React.useEffect(() => {
    const video = videoRef.current
    if (!video || typeof IntersectionObserver === 'undefined') return

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      video.pause()
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          void video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { threshold: 0.12 },
    )

    observer.observe(video)

    return () => {
      observer.disconnect()
    }
  }, [])

  React.useEffect(() => {
    let active = true

    void getTooliaClientState().then((state) => {
      if (active) setSecondaryCta(state.ctaLabel)
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
        ref={videoRef}
        className="hero-video absolute inset-0 h-full w-full object-cover object-[55%_center] sm:object-center"
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

      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.82)_0%,rgba(6,16,31,0.68)_36%,rgba(6,16,31,0.74)_68%,rgba(2,6,23,0.9)_100%)] sm:hidden" />
      <div className="absolute inset-0 hidden bg-gradient-to-b from-white/38 via-white/18 to-white/62 dark:from-[#030712]/72 dark:via-[#06101f]/58 dark:to-[#030712]/84 sm:block" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.36),rgba(2,6,23,0.18)_44%,transparent_72%)] sm:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.28),rgba(255,255,255,0.1)_42%,transparent_68%)] sm:dark:bg-[radial-gradient(ellipse_at_center,rgba(3,7,18,0.42),rgba(3,7,18,0.24)_46%,transparent_72%)]" />
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-toolia-bg-main via-toolia-bg-main/60 to-transparent sm:h-40" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-5 pb-32 pt-12 text-center sm:px-6 sm:py-16 md:px-8 lg:px-10">
        <motion.div
          className="mx-auto flex max-w-6xl flex-col items-center"
          initial="hidden"
          animate="visible"
          variants={heroGroup}
        >
          <motion.h1
            className="font-heading mx-auto max-w-[21rem] text-center text-[clamp(2.85rem,12.2vw,4.35rem)] font-extrabold leading-[0.9] tracking-[-0.055em] text-white drop-shadow-[0_10px_36px_rgba(0,0,0,0.7)] [text-wrap:balance] sm:max-w-[1100px] sm:text-[clamp(4rem,10vw,9.5rem)] sm:text-slate-950 sm:drop-shadow-[0_1px_18px_rgba(255,255,255,0.34)] sm:dark:text-white sm:dark:drop-shadow-[0_8px_34px_rgba(0,0,0,0.58)]"
            variants={heroItem}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="block">Votre boîte mail</span>
            <span className="block">se gère toute seule.</span>
          </motion.h1>

          <motion.div
            className="mt-4 h-[3px] w-24 rounded-full bg-white/80 shadow-[0_0_26px_rgba(255,255,255,0.36)] sm:mt-5 sm:w-28 sm:bg-toolia-primary/70 sm:shadow-[0_0_24px_rgba(31,42,77,0.26)] sm:dark:bg-white/60 sm:dark:shadow-[0_0_24px_rgba(147,197,253,0.32)]"
            variants={heroItem}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.p
            className="mt-4 max-w-[21rem] text-base font-semibold leading-7 text-white/95 drop-shadow-[0_4px_24px_rgba(0,0,0,0.72)] sm:mt-5 sm:max-w-3xl sm:text-[clamp(1.1rem,1.45vw,1.55rem)] sm:font-normal sm:leading-relaxed sm:text-slate-700 sm:drop-shadow-[0_2px_12px_rgba(255,255,255,0.4)] sm:dark:text-white/[0.88] sm:dark:drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)]"
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
                trackEvent('cta_click', {
                  cta_location: 'hero',
                  cta_label: 'Diagnostiquer ma boîte mail',
                })
                window.location.href = '/diagnostic'
              }}
              className="min-h-[4.15rem] w-full border border-white/70 bg-[#172554] text-lg font-extrabold shadow-[0_24px_68px_rgba(15,23,42,0.42)] ring-1 ring-white/70 hover:bg-[#1d4ed8] hover:shadow-[0_26px_70px_rgba(29,78,216,0.42)] dark:bg-[#172554] dark:text-white dark:ring-white/30 dark:hover:bg-[#1d4ed8] sm:min-h-0 sm:w-auto sm:border-0 sm:text-base sm:font-bold sm:shadow-[0_22px_60px_rgba(29,78,216,0.34)] sm:dark:bg-blue-500 sm:dark:ring-white/20 sm:dark:hover:bg-blue-400"
            >
              Diagnostiquer ma boîte mail
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                trackEvent('cta_click', {
                  cta_location: 'hero',
                  cta_label: secondaryCta,
                })
                void routeToTooliaStart()
              }}
              className="min-h-[3.45rem] w-full border-white/50 bg-white/[0.9] py-3 text-base font-semibold text-slate-950 shadow-[0_14px_36px_rgba(15,23,42,0.18)] hover:bg-white hover:shadow-[0_16px_42px_rgba(15,23,42,0.18)] dark:border-white/50 dark:bg-white/[0.9] dark:text-slate-950 dark:hover:bg-white sm:min-h-0 sm:w-auto sm:border-white/70 sm:bg-white/[0.78] sm:py-4 sm:shadow-[0_14px_36px_rgba(15,23,42,0.12)] sm:backdrop-blur-md sm:dark:border-white/25 sm:dark:bg-slate-950/38 sm:dark:text-white sm:dark:hover:bg-slate-900/58"
            >
              {secondaryCta}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                trackEvent('cta_click', {
                  cta_location: 'hero',
                  cta_label: copy.hero.cta2,
                })
                handleSmoothScroll('#how')
              }}
              className="min-h-[3.45rem] w-full border-white/50 bg-white/[0.9] py-3 text-base font-semibold text-slate-950 shadow-[0_14px_36px_rgba(15,23,42,0.18)] hover:bg-white hover:shadow-[0_16px_42px_rgba(15,23,42,0.18)] dark:border-white/50 dark:bg-white/[0.9] dark:text-slate-950 dark:hover:bg-white sm:min-h-0 sm:w-auto sm:border-white/70 sm:bg-white/[0.78] sm:py-4 sm:shadow-[0_14px_36px_rgba(15,23,42,0.12)] sm:backdrop-blur-md sm:dark:border-white/25 sm:dark:bg-slate-950/38 sm:dark:text-white sm:dark:hover:bg-slate-900/58"
            >
              {copy.hero.cta2}
            </Button>
          </motion.div>

          <motion.p
            className="mt-4 text-xs font-bold text-white/90 drop-shadow-[0_3px_16px_rgba(0,0,0,0.66)] sm:mt-6 sm:font-medium sm:text-slate-800 sm:drop-shadow-[0_2px_10px_rgba(255,255,255,0.36)] sm:dark:text-white/[0.85] sm:dark:drop-shadow-[0_2px_12px_rgba(0,0,0,0.46)]"
            variants={heroItem}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="sm:hidden">Gratuit • 2 minutes • Aucune connexion Gmail</span>
            <span className="hidden sm:inline">{copy.hero.subCta}</span>
          </motion.p>
        </motion.div>
      </div>
    </section>
  )
}

Hero.displayName = 'Hero'

