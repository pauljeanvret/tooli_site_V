'use client'

import React from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { Button } from './Button'
import { trackEvent } from '@/lib/analytics'

const calmSignals = [
  'Le bruit est filtré',
  'Vos réponses avancent',
  'Votre Gmail reste organisé',
  'Vous gardez le contrôle',
]

export const Values: React.FC = () => {
  const sectionRef = React.useRef<HTMLElement>(null)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const reduceMotion = useReducedMotion()
  const [canUseScrollExpansion, setCanUseScrollExpansion] = React.useState(false)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video || typeof IntersectionObserver === 'undefined') return

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
  }, [reduceMotion])

  React.useEffect(() => {
    const desktopMedia = window.matchMedia('(min-width: 768px)')
    const coarsePointerMedia = window.matchMedia('(pointer: coarse)')
    const hoverNoneMedia = window.matchMedia('(hover: none)')
    const isIosLike =
      /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
      (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)

    const update = () => {
      setCanUseScrollExpansion(desktopMedia.matches && !coarsePointerMedia.matches && !hoverNoneMedia.matches && !isIosLike)
    }

    update()
    const mediaQueries = [desktopMedia, coarsePointerMedia, hoverNoneMedia]
    mediaQueries.forEach((media) => {
      if (typeof media.addEventListener === 'function') {
        media.addEventListener('change', update)
      } else {
        media.addListener(update)
      }
    })

    return () => {
      mediaQueries.forEach((media) => {
        if (typeof media.removeEventListener === 'function') {
          media.removeEventListener('change', update)
        } else {
          media.removeListener(update)
        }
      })
    }
  }, [])

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  const mediaScale = useTransform(scrollYProgress, [0.04, 0.48, 0.82], [0.76, 1, 1])
  const mediaRadius = useTransform(scrollYProgress, [0.04, 0.48, 0.82], ['2.35rem', '0.65rem', '0.65rem'])
  const mediaOpacity = useTransform(scrollYProgress, [0, 0.14], [0.92, 1])
  const mediaY = useTransform(scrollYProgress, [0.04, 0.48, 0.82], [28, 0, 0])
  const copyOpacity = useTransform(scrollYProgress, [0.04, 0.18, 0.86, 0.96], [0, 1, 1, 0.96])
  const copyY = useTransform(scrollYProgress, [0.04, 0.48], [18, 0])

  const animateDesktopExpansion = Boolean(canUseScrollExpansion && !reduceMotion)

  const handleDiagnosticClick = () => {
    trackEvent('cta_click', {
      cta_location: 'calm_section',
      cta_label: 'Diagnostiquer ma boîte mail',
    })
    window.location.href = '/diagnostic'
  }

  const media = (
    <motion.div
      className={
        animateDesktopExpansion
          ? 'absolute inset-0 transform-gpu overflow-hidden rounded-[38px] border border-white/55 bg-[#eef4f8] shadow-[0_34px_110px_rgba(15,23,42,0.15)] will-change-transform [contain:layout_paint] dark:border-white/12 dark:bg-[#06101f] dark:shadow-[0_36px_120px_rgba(0,0,0,0.42)]'
          : 'absolute inset-0 overflow-hidden rounded-[28px] border border-white/55 bg-[#eef4f8] shadow-[0_34px_110px_rgba(15,23,42,0.15)] sm:rounded-[42px] dark:border-white/12 dark:bg-[#06101f] dark:shadow-[0_36px_120px_rgba(0,0,0,0.42)]'
      }
      style={
        animateDesktopExpansion
          ? {
              scale: mediaScale,
              y: mediaY,
              opacity: mediaOpacity,
              borderRadius: mediaRadius,
              transformOrigin: 'center center',
            }
          : undefined
      }
    >
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/videos/calm-water-poster.jpg"
        aria-hidden="true"
      >
        <source src="/videos/calm-water.mp4" type="video/mp4" />
      </video>

      <div className="absolute inset-0 bg-gradient-to-br from-white/44 via-white/18 to-sky-100/24 dark:from-[#020817]/60 dark:via-[#06101f]/36 dark:to-[#020617]/70" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.52),rgba(255,255,255,0.14)_42%,transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_48%,rgba(2,6,23,0.68),rgba(2,6,23,0.26)_44%,transparent_72%)]" />
      <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/18 to-transparent dark:from-[#020617]/28 sm:h-36" />
    </motion.div>
  )

  const content = (
    <motion.div
      className="relative z-10 mx-auto w-[min(88vw,24rem)] text-center sm:w-auto sm:max-w-5xl"
      style={animateDesktopExpansion ? { opacity: copyOpacity, y: copyY } : undefined}
    >
      <div className="pointer-events-none absolute -inset-x-5 -inset-y-8 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.50),rgba(2,6,23,0.22)_46%,transparent_72%)] sm:-inset-x-8 sm:-inset-y-10 sm:bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.30),rgba(255,255,255,0.10)_46%,transparent_72%)] sm:dark:bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.44),rgba(2,6,23,0.16)_48%,transparent_72%)]" />

      <div className="relative">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-100/95 drop-shadow-[0_2px_12px_rgba(0,0,0,0.5)] sm:text-toolia-info sm:drop-shadow-none sm:dark:text-sky-200">
          Calme et contrôle
        </p>
        <h2 className="font-heading mx-auto mt-4 max-w-[22rem] text-[clamp(2.25rem,11vw,3.5rem)] font-extrabold leading-[0.95] tracking-[-0.04em] text-white [text-wrap:balance] drop-shadow-[0_8px_30px_rgba(0,0,0,0.58)] sm:mt-5 sm:max-w-5xl sm:text-[clamp(2.6rem,5.8vw,6.6rem)] sm:text-slate-950 sm:drop-shadow-[0_1px_18px_rgba(255,255,255,0.25)] sm:dark:text-white sm:dark:drop-shadow-[0_8px_30px_rgba(0,0,0,0.56)]">
          Retrouvez le calme dans votre boîte mail.
        </h2>
        <p className="mx-auto mt-5 max-w-[21rem] text-sm leading-7 text-white/82 drop-shadow-[0_2px_14px_rgba(0,0,0,0.5)] sm:mt-7 sm:max-w-3xl sm:text-base sm:leading-8 sm:text-slate-700 sm:drop-shadow-none md:text-lg sm:dark:text-white/82">
          Toolia filtre le bruit, prépare les réponses utiles et vous laisse valider ce qui compte vraiment.
          Votre boîte mail reste organisée, vos réponses avancent, et vous gardez toujours le contrôle.
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-2 sm:mt-10 sm:gap-3">
          {calmSignals.map((signal, index) => (
            <motion.span
              key={signal}
              className={`${index > 2 ? 'hidden sm:inline-flex' : 'inline-flex'} rounded-full border border-white/75 bg-white/64 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-[0_10px_32px_rgba(15,23,42,0.1)] backdrop-blur-md sm:px-4 sm:py-2 sm:text-sm dark:border-white/20 dark:bg-[#102039]/68 dark:text-white/90 dark:shadow-[0_12px_38px_rgba(0,0,0,0.26)]`}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: index * 0.07 }}
            >
              {signal}
            </motion.span>
          ))}
        </div>

        <div className="mt-7 flex justify-center sm:mt-9">
          <Button
            variant="primary"
            size="lg"
            onClick={handleDiagnosticClick}
            className="w-full max-w-xs bg-[#172554] shadow-[0_22px_60px_rgba(29,78,216,0.28)] ring-1 ring-white/60 hover:bg-[#1d4ed8] dark:bg-blue-500 dark:hover:bg-blue-400 sm:w-auto sm:max-w-none"
          >
            Diagnostiquer ma boîte mail
          </Button>
        </div>
      </div>
    </motion.div>
  )

  return (
    <section
      ref={sectionRef}
      id="product"
      className={
        animateDesktopExpansion
          ? 'relative h-[136vh] overflow-clip bg-toolia-bg-main dark:bg-[#0d1117]'
          : 'relative overflow-hidden bg-toolia-bg-main px-4 py-10 sm:px-6 md:px-8 md:py-16 xl:px-10 dark:bg-[#0d1117]'
      }
    >
      <div
        className={
          animateDesktopExpansion
            ? 'relative sticky top-0 h-screen overflow-hidden'
            : 'relative mx-auto flex min-h-[560px] w-full max-w-[1560px] items-center justify-center overflow-hidden rounded-[28px] sm:min-h-[590px] sm:rounded-[42px] md:min-h-[640px]'
        }
      >
        {media}
        <div className="relative z-10 flex h-full min-h-[560px] items-center justify-center px-5 py-14 text-center sm:min-h-[590px] sm:px-10 sm:py-20 md:min-h-[640px] md:py-24">
          {content}
        </div>
      </div>
    </section>
  )
}

Values.displayName = 'Values'
