'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const FORCE_INTRO_KEY = 'tooliaForceIntro'
const INTRO_PLAYED_KEY = 'tooliaHomeIntroPlayed'
const INTRO_MAX_DURATION_MS = 1280
const INTRO_ERROR_FALLBACK_MS = 850
const INTRO_REDUCED_MOTION_MS = 180
const INTRO_FADE_MS = 430
const LOGO_PLAYBACK_RATE = 1.75

function introBootstrapScript() {
  return `
    (() => {
      try {
        const navigation = performance.getEntriesByType('navigation')[0];
        const isReload = navigation && navigation.type === 'reload';
        const forceIntro = sessionStorage.getItem('${FORCE_INTRO_KEY}') === '1';
        const played = sessionStorage.getItem('${INTRO_PLAYED_KEY}') === '1';
        document.documentElement.dataset.tooliaIntro = forceIntro || isReload || !played ? 'play' : 'skip';
      } catch (error) {
        document.documentElement.dataset.tooliaIntro = 'play';
      }
    })();
  `
}

function isReloadNavigation() {
  const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
  return navigation?.type === 'reload'
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function readSessionFlag(key: string) {
  try {
    return window.sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function writeSessionFlag(key: string) {
  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // Storage can be unavailable in private or restricted browsing modes.
  }
}

function removeSessionFlag(key: string) {
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // Storage can be unavailable in private or restricted browsing modes.
  }
}

export function HomeIntroOverlay() {
  const [isMounted, setIsMounted] = useState(true)
  const [isExiting, setIsExiting] = useState(false)
  const [shouldPlayVideo, setShouldPlayVideo] = useState(true)
  const [showFallbackLogo, setShowFallbackLogo] = useState(true)
  const timersRef = useRef<number[]>([])
  const finishingRef = useRef(false)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
  }, [])

  const finishIntro = useCallback(() => {
    if (finishingRef.current) return

    finishingRef.current = true
    writeSessionFlag(INTRO_PLAYED_KEY)
    document.documentElement.dataset.tooliaIntro = 'exiting'
    setIsExiting(true)

    const fadeTimer = window.setTimeout(() => {
      setIsMounted(false)
      setShouldPlayVideo(false)
      setShowFallbackLogo(false)
      document.documentElement.dataset.tooliaIntro = 'done'
    }, INTRO_FADE_MS)
    timersRef.current.push(fadeTimer)
  }, [])

  const startIntro = useCallback(() => {
    clearTimers()
    finishingRef.current = false
    removeSessionFlag(FORCE_INTRO_KEY)
    document.documentElement.dataset.tooliaIntro = 'play'

    const reducedMotion = prefersReducedMotion()
    setShouldPlayVideo(!reducedMotion)
    setShowFallbackLogo(true)
    setIsMounted(true)
    setIsExiting(false)

    const duration = reducedMotion ? INTRO_REDUCED_MOTION_MS : INTRO_MAX_DURATION_MS
    const maxTimer = window.setTimeout(finishIntro, duration)
    timersRef.current.push(maxTimer)
  }, [clearTimers, finishIntro])

  useEffect(() => {
    const forceIntro = readSessionFlag(FORCE_INTRO_KEY)
    const shouldPlayIntro = forceIntro || isReloadNavigation() || !readSessionFlag(INTRO_PLAYED_KEY)

    if (shouldPlayIntro) {
      startIntro()
    } else {
      setIsMounted(false)
      setShouldPlayVideo(false)
      setShowFallbackLogo(false)
      document.documentElement.dataset.tooliaIntro = 'done'
    }

    const replayIntro = () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      startIntro()
    }

    window.addEventListener('toolia:playIntro', replayIntro)

    return () => {
      clearTimers()
      window.removeEventListener('toolia:playIntro', replayIntro)
    }
  }, [clearTimers, startIntro])

  return (
    <>
      <script
        id="toolia-intro-bootstrap"
        dangerouslySetInnerHTML={{ __html: introBootstrapScript() }}
      />
      <style>
        {`
          html[data-toolia-intro="skip"] .toolia-intro-overlay {
            display: none;
          }

          @media (prefers-reduced-motion: reduce) {
            .toolia-intro-video {
              display: none;
            }
          }
        `}
      </style>
      {isMounted && (
        <div
          aria-hidden="true"
          className={`toolia-intro-overlay fixed inset-0 z-[120] flex items-center justify-center bg-[#020817]/55 backdrop-blur-[2px] transition-opacity duration-[430ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isExiting ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <img
            src="/profile/logo_white_transparent.png"
            alt=""
            className={`absolute w-[190px] drop-shadow-[0_0_30px_rgba(125,211,252,0.18)] transition-opacity duration-300 ease-out sm:w-[240px] md:w-[300px] lg:w-[330px] ${
              showFallbackLogo ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {shouldPlayVideo && (
            <video
              src="/animations/toolia_logo_motion_bidir_blue_transparent.webm"
              className={`toolia-intro-video relative w-[190px] drop-shadow-[0_0_34px_rgba(34,211,238,0.16)] transition-opacity duration-200 sm:w-[240px] md:w-[300px] lg:w-[330px] ${
                showFallbackLogo ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ filter: 'saturate(0.78) brightness(0.94) contrast(1.03)' }}
              autoPlay
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(event) => {
                event.currentTarget.playbackRate = LOGO_PLAYBACK_RATE
              }}
              onPlaying={() => {
                setShowFallbackLogo(false)
              }}
              onCanPlay={(event) => {
                event.currentTarget.play().catch(() => {
                  setShowFallbackLogo(true)
                })
              }}
              onEnded={finishIntro}
              onStalled={() => {
                setShowFallbackLogo(true)
              }}
              onError={() => {
                setShowFallbackLogo(true)
                setShouldPlayVideo(false)
                const fallbackTimer = window.setTimeout(finishIntro, INTRO_ERROR_FALLBACK_MS)
                timersRef.current.push(fallbackTimer)
              }}
            />
          )}
        </div>
      )}
    </>
  )
}
