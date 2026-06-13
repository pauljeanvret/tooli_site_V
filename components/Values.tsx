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
  const [isDesktop, setIsDesktop] = React.useState<boolean | null>(null)

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

  const desktopPanelWidth = useTransform(scrollYProgress, [0.1, 0.68], ['min(84vw, 72rem)', '100vw'])
  const desktopPanelHeight = useTransform(scrollYProgress, [0.1, 0.68], ['clamp(28rem, 48vh, 42rem)', '100vh'])
  const desktopPanelRadius = useTransform(scrollYProgress, [0.1, 0.68], ['2.35rem', '0rem'])
  const desktopPanelOpacity = useTransform(scrollYProgress, [0, 0.14], [0.92, 1])
  const desktopPanelY = useTransform(scrollYProgress, [0.1, 0.68], [26, 0])

  const mobilePanelWidth = useTransform(scrollYProgress, [0.1, 0.58], ['92vw', '100vw'])
  const mobilePanelHeight = useTransform(scrollYProgress, [0.1, 0.58], ['52svh', '92svh'])
  const mobilePanelRadius = useTransform(scrollYProgress, [0.1, 0.58], ['1.75rem', '0rem'])
  const mobilePanelOpacity = useTransform(scrollYProgress, [0, 0.14], [0.96, 1])
  const mobilePanelY = useTransform(scrollYProgress, [0.1, 0.58], [16, 0])

  const animateDesktopExpansion = Boolean(isDesktop === true && !reduceMotion)
  const animateMobileExpansion = Boolean(isDesktop === false && !reduceMotion)
  return (
    <section
      ref={sectionRef}
      id="product"
      className={
        animateDesktopExpansion
          ? 'relative h-[150vh] overflow-clip bg-toolia-bg-main'
          : animateMobileExpansion
            ? 'relative h-[135svh] overflow-clip bg-toolia-bg-main'
            : 'relative overflow-hidden bg-toolia-bg-main px-4 py-10 sm:px-6 md:px-8 md:py-16 xl:px-10'
      }
    >
      <div
        className={
          animateDesktopExpansion
            ? 'sticky top-0 flex h-screen items-center justify-center overflow-hidden'
            : animateMobileExpansion
              ? 'sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden'
              : 'mx-auto flex w-full max-w-[1560px] items-center justify-center'
        }
      >
        <motion.div
          className="relative min-h-[560px] w-full overflow-hidden rounded-[28px] border border-white/55 bg-[#eef4f8] shadow-[0_34px_110px_rgba(15,23,42,0.15)] sm:min-h-[590px] sm:rounded-[42px] md:min-h-0 dark:border-white/12 dark:bg-[#06101f] dark:shadow-[0_36px_120px_rgba(0,0,0,0.42)]"
          style={
            animateDesktopExpansion
              ? {
                  width: desktopPanelWidth,
                  height: desktopPanelHeight,
                  y: desktopPanelY,
                  opacity: desktopPanelOpacity,
                  borderRadius: desktopPanelRadius,
                }
              : animateMobileExpansion
                ? {
                  width: mobilePanelWidth,
                  height: mobilePanelHeight,
                  y: mobilePanelY,
                  opacity: mobilePanelOpacity,
                  borderRadius: mobilePanelRadius,
                }
                : undefined
          }
        >
          {/* Calm water video only. Keep it forward-only: no ping-pong/reverse loop. */}
          <video
            className="absolute inset-0 h-full w-full object-cover brightness-[1.08] contrast-[1.02] saturate-[0.98] dark:brightness-[0.72] dark:contrast-[1.06] dark:saturate-[0.9] sm:brightness-[1.04] sm:saturate-[0.95] sm:dark:brightness-[0.64] sm:dark:contrast-[1.08] sm:dark:saturate-[0.84]"
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

          <div className="absolute inset-0 bg-gradient-to-br from-white/32 via-white/10 to-[#f3eadf]/24 dark:from-[#020817]/36 dark:via-[#06101f]/20 dark:to-[#020617]/42 sm:from-white/48 sm:via-white/18 sm:to-[#f3eadf]/42 sm:dark:from-[#020817]/54 sm:dark:via-[#06101f]/34 sm:dark:to-[#020617]/58" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.48),rgba(255,255,255,0.12)_42%,transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_48%,rgba(2,6,23,0.54),rgba(2,6,23,0.18)_44%,transparent_72%)] sm:bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.54),rgba(255,255,255,0.14)_42%,transparent_70%)] sm:dark:bg-[radial-gradient(circle_at_50%_48%,rgba(2,6,23,0.66),rgba(2,6,23,0.24)_44%,transparent_72%)]" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/14 to-transparent dark:from-[#020617]/20 sm:h-32" />

          <div className="relative z-10 flex h-full items-center justify-center px-5 py-14 text-center sm:px-10 sm:py-20 md:py-24">
            <div className="relative mx-auto max-w-5xl">
              <div className="pointer-events-none absolute -inset-x-5 -inset-y-8 rounded-[2rem] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.34),rgba(255,255,255,0.12)_46%,transparent_72%)] backdrop-blur-[1.5px] sm:-inset-x-8 sm:-inset-y-10 dark:bg-[radial-gradient(ellipse_at_center,rgba(2,6,23,0.42),rgba(2,6,23,0.16)_48%,transparent_72%)]" />

              <div className="relative">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-toolia-info dark:text-sky-200">
                  Calme et contrôle
                </p>
                <h2 className="mx-auto mt-4 max-w-[22rem] text-[clamp(2.25rem,11vw,3.5rem)] font-semibold leading-[0.92] tracking-[-0.055em] text-slate-950 [text-wrap:balance] drop-shadow-[0_1px_18px_rgba(255,255,255,0.25)] sm:mt-5 sm:max-w-5xl sm:text-[clamp(2.6rem,5.8vw,6.6rem)] dark:text-white dark:drop-shadow-[0_8px_30px_rgba(0,0,0,0.56)]">
                  Retrouvez le calme dans votre boîte mail.
                </h2>
                <p className="mx-auto mt-5 max-w-[21rem] text-sm leading-7 text-slate-700 sm:mt-7 sm:max-w-3xl sm:text-base sm:leading-8 md:text-lg dark:text-white/82">
                  Toolia filtre le bruit, prépare les réponses utiles et vous laisse valider ce qui compte vraiment.
                  Votre boîte mail reste organisée, vos réponses avancent, et vous gardez toujours le contrôle.
                </p>

                <div className="mt-7 flex flex-wrap items-center justify-center gap-2 sm:mt-10 sm:gap-3">
                  {calmSignals.map((signal, index) => (
                    <motion.span
                      key={signal}
                      className={`${index > 2 ? 'hidden sm:inline-flex' : 'inline-flex'} rounded-full border border-white/75 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-[0_10px_32px_rgba(15,23,42,0.1)] backdrop-blur-md sm:px-4 sm:py-2 sm:text-sm dark:border-white/18 dark:bg-[#102039]/64 dark:text-white/88 dark:shadow-[0_12px_38px_rgba(0,0,0,0.26)]`}
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
