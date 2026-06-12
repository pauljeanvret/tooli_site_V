'use client'

import React from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'

const calmSignals = [
  'Le bruit est filtré',
  'Vos réponses avancent',
  'Votre Gmail reste organisé',
  'Vous gardez le contrôle',
]

export const Values: React.FC = () => {
  const sectionRef = React.useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()
  const [isDesktop, setIsDesktop] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const update = () => setIsDesktop(media.matches)

    update()
    media.addEventListener('change', update)

    return () => {
      media.removeEventListener('change', update)
    }
  }, [])

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start'],
  })

  const panelWidth = useTransform(scrollYProgress, [0.1, 0.68], ['min(84vw, 72rem)', '100vw'])
  const panelHeight = useTransform(scrollYProgress, [0.1, 0.68], ['clamp(28rem, 48vh, 42rem)', '100vh'])
  const panelRadius = useTransform(scrollYProgress, [0.1, 0.68], ['2.35rem', '0rem'])
  const panelOpacity = useTransform(scrollYProgress, [0, 0.14], [0.92, 1])
  const panelY = useTransform(scrollYProgress, [0.1, 0.68], [26, 0])
  const animateExpansion = Boolean(isDesktop && !reduceMotion)

  return (
    <section
      ref={sectionRef}
      id="product"
      className={
        animateExpansion
          ? 'relative h-[150vh] overflow-clip bg-toolia-bg-main'
          : 'relative overflow-hidden bg-toolia-bg-main px-4 py-10 sm:px-6 md:px-8 md:py-16 xl:px-10'
      }
    >
      <div
        className={
          animateExpansion
            ? 'sticky top-0 flex h-screen items-center justify-center overflow-hidden'
            : 'mx-auto flex w-full max-w-[1560px] items-center justify-center'
        }
      >
        <motion.div
          className="relative min-h-[590px] w-full overflow-hidden rounded-[34px] border border-white/55 bg-[#eef4f8] shadow-[0_34px_110px_rgba(15,23,42,0.15)] sm:rounded-[42px] md:min-h-0 dark:border-white/12 dark:bg-[#06101f] dark:shadow-[0_36px_120px_rgba(0,0,0,0.42)]"
          style={
            animateExpansion
              ? {
                  width: panelWidth,
                  height: panelHeight,
                  y: panelY,
                  opacity: panelOpacity,
                  borderRadius: panelRadius,
                }
              : undefined
          }
        >
          {/* Calm water video only. Keep it forward-only: no ping-pong/reverse loop. */}
          <video
            className="absolute inset-0 h-full w-full object-cover brightness-[1.04] contrast-[1.02] saturate-[0.95] dark:brightness-[0.64] dark:contrast-[1.08] dark:saturate-[0.84]"
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

          <div className="absolute inset-0 bg-gradient-to-br from-white/48 via-white/18 to-[#f3eadf]/42 dark:from-[#020817]/54 dark:via-[#06101f]/34 dark:to-[#020617]/58" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.54),rgba(255,255,255,0.14)_42%,transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_48%,rgba(2,6,23,0.66),rgba(2,6,23,0.24)_44%,transparent_72%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white/16 to-transparent dark:from-[#020617]/22" />

          <div className="relative z-10 flex h-full items-center justify-center px-6 py-20 text-center sm:px-10 md:py-24">
            <div className="relative mx-auto max-w-5xl">
              <div className="pointer-events-none absolute -inset-x-8 -inset-y-10 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.34),rgba(255,255,255,0.12)_46%,transparent_72%)] backdrop-blur-[1.5px] dark:bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.42),rgba(2,6,23,0.16)_48%,transparent_72%)]" />

              <div className="relative">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-toolia-info dark:text-sky-200">
                  Calme et contrôle
                </p>
                <h2 className="mx-auto mt-5 max-w-5xl text-[clamp(2.6rem,5.8vw,6.6rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-slate-950 [text-wrap:balance] drop-shadow-[0_1px_18px_rgba(255,255,255,0.25)] dark:text-white dark:drop-shadow-[0_8px_30px_rgba(0,0,0,0.56)]">
                  Retrouvez le calme dans votre boîte mail.
                </h2>
                <p className="mx-auto mt-7 max-w-3xl text-base leading-8 text-slate-700 md:text-lg dark:text-white/82">
                  Toolia filtre le bruit, prépare les réponses utiles et vous laisse valider ce qui compte vraiment.
                  Votre boîte mail reste organisée, vos réponses avancent, et vous gardez toujours le contrôle.
                </p>

                <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
                  {calmSignals.map((signal, index) => (
                    <motion.span
                      key={signal}
                      className="rounded-full border border-white/75 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-800 shadow-[0_10px_32px_rgba(15,23,42,0.1)] backdrop-blur-md dark:border-white/18 dark:bg-[#102039]/64 dark:text-white/88 dark:shadow-[0_12px_38px_rgba(0,0,0,0.26)]"
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.35, delay: index * 0.07 }}
                    >
                      {signal}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

Values.displayName = 'Values'
