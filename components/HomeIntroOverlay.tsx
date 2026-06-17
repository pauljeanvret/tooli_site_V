'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const FORCE_INTRO_KEY = 'tooliaForceIntro'
const INTRO_PLAYED_KEY = 'tooliaHomeIntroPlayed'
const INTRO_MAX_DURATION_MS = 1280
const INTRO_FALLBACK_DURATION_MS = 950
const INTRO_VIDEO_START_FALLBACK_MS = 360
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
        const ua = navigator.userAgent || '';
        const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
        const isUnsupported = isIOS || isSafari;
        document.documentElement.dataset.tooliaIntro = isUnsupported ? 'disabled' : forceIntro || isReload || !played ? 'play' : 'skip';
        document.documentElement.dataset.tooliaIntroMode = 'video';
      } catch (error) {
        document.documentElement.dataset.tooliaIntro = 'play';
        document.documentElement.dataset.tooliaIntroMode = 'video';
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

function isSafariOrIOS() {
  if (typeof window === 'undefined') return false

  const ua = window.navigator.userAgent || ''
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1)
  const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua)

  return isIOS || isSafari
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
  const [mode, setMode] = useState<'video' | 'fallback'>('video')
  const timersRef = useRef<number[]>([])
  const finishingRef = useRef(false)
  const videoStartedRef = useRef(false)

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer))
    timersRef.current = []
  }, [])

  const disableIntro = useCallback(() => {
    clearTimers()
    finishingRef.current = true
    videoStartedRef.current = false
    removeSessionFlag(FORCE_INTRO_KEY)
    writeSessionFlag(INTRO_PLAYED_KEY)
    document.documentElement.dataset.tooliaIntro = 'disabled'
    document.documentElement.dataset.tooliaIntroMode = 'video'
    setIsMounted(false)
    setIsExiting(false)
    setShouldPlayVideo(false)
    setMode('video')
  }, [clearTimers])

  const finishIntro = useCallback(() => {
    if (finishingRef.current) return

    finishingRef.current = true
    writeSessionFlag(INTRO_PLAYED_KEY)
    document.documentElement.dataset.tooliaIntro = 'exiting'
    setIsExiting(true)

    const fadeTimer = window.setTimeout(() => {
      setIsMounted(false)
      setShouldPlayVideo(false)
      document.documentElement.dataset.tooliaIntro = 'done'
    }, INTRO_FADE_MS)
    timersRef.current.push(fadeTimer)
  }, [])

  const startIntro = useCallback(() => {
    if (isSafariOrIOS()) {
      disableIntro()
      return
    }

    clearTimers()
    finishingRef.current = false
    videoStartedRef.current = false
    removeSessionFlag(FORCE_INTRO_KEY)
    document.documentElement.dataset.tooliaIntro = 'play'

    const reducedMotion = prefersReducedMotion()
    const shouldUseFallback = reducedMotion
    const nextMode = shouldUseFallback ? 'fallback' : 'video'

    document.documentElement.dataset.tooliaIntroMode = nextMode
    setMode(nextMode)
    setShouldPlayVideo(nextMode === 'video')
    setIsMounted(true)
    setIsExiting(false)

    if (nextMode === 'video') {
      const videoStartTimer = window.setTimeout(() => {
        if (videoStartedRef.current || finishingRef.current) return
        document.documentElement.dataset.tooliaIntroMode = 'fallback'
        setMode('fallback')
        setShouldPlayVideo(false)
      }, INTRO_VIDEO_START_FALLBACK_MS)
      timersRef.current.push(videoStartTimer)
    }

    const duration = reducedMotion
      ? INTRO_REDUCED_MOTION_MS
      : nextMode === 'fallback'
        ? INTRO_FALLBACK_DURATION_MS
        : INTRO_MAX_DURATION_MS
    const maxTimer = window.setTimeout(finishIntro, duration)
    timersRef.current.push(maxTimer)
  }, [clearTimers, disableIntro, finishIntro])

  useEffect(() => {
    if (isSafariOrIOS()) {
      disableIntro()
      return
    }

    const forceIntro = readSessionFlag(FORCE_INTRO_KEY)
    const shouldPlayIntro = forceIntro || isReloadNavigation() || !readSessionFlag(INTRO_PLAYED_KEY)

    if (shouldPlayIntro) {
      startIntro()
    } else {
      setIsMounted(false)
      setShouldPlayVideo(false)
      document.documentElement.dataset.tooliaIntro = 'done'
    }

    const replayIntro = () => {
      if (isSafariOrIOS()) {
        disableIntro()
        window.scrollTo({ top: 0, behavior: 'auto' })
        return
      }

      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
      startIntro()
    }

    window.addEventListener('toolia:playIntro', replayIntro)

    return () => {
      clearTimers()
      window.removeEventListener('toolia:playIntro', replayIntro)
    }
  }, [clearTimers, disableIntro, startIntro])

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

          html[data-toolia-intro="disabled"] .toolia-intro-overlay {
            display: none;
          }

          @media (prefers-reduced-motion: reduce) {
            .toolia-intro-video {
              display: none;
            }
          }

          .toolia-intro-fallback {
            opacity: 0;
            transform: scale(0.96);
          }

          html[data-toolia-intro-mode="fallback"] .toolia-intro-fallback {
            opacity: 1;
            transform: scale(1);
          }

          html[data-toolia-intro-mode="fallback"] .toolia-intro-video {
            display: none;
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
          <span
            aria-hidden="true"
            className={`toolia-intro-fallback absolute h-[190px] w-[190px] bg-[linear-gradient(135deg,#1f2a4d_0%,#2563eb_48%,#14b8a6_100%)] drop-shadow-[0_0_34px_rgba(20,184,166,0.16)] transition-[opacity,transform] duration-300 ease-out sm:h-[240px] sm:w-[240px] md:h-[300px] md:w-[300px] lg:h-[330px] lg:w-[330px] ${
              mode === 'fallback' ? 'opacity-100 scale-100' : 'opacity-0 scale-[0.96]'
            }`}
            style={{
              WebkitMask: 'url("/profile/logo_white_transparent.png") center / contain no-repeat',
              mask: 'url("/profile/logo_white_transparent.png") center / contain no-repeat',
            }}
          />
          {shouldPlayVideo && (
            <video
              src="/animations/toolia_logo_motion_bidir_blue_transparent.webm"
              className="toolia-intro-video relative w-[190px] bg-transparent drop-shadow-[0_0_34px_rgba(34,211,238,0.16)] transition-opacity duration-200 sm:w-[240px] md:w-[300px] lg:w-[330px]"
              style={{ filter: 'saturate(0.78) brightness(0.94) contrast(1.03)' }}
              autoPlay
              muted
              playsInline
              preload="auto"
              onLoadedMetadata={(event) => {
                event.currentTarget.playbackRate = LOGO_PLAYBACK_RATE
              }}
              onPlaying={() => {
                videoStartedRef.current = true
                document.documentElement.dataset.tooliaIntroMode = 'video'
                setMode('video')
              }}
              onCanPlay={(event) => {
                event.currentTarget.play().catch(() => {
                  document.documentElement.dataset.tooliaIntroMode = 'fallback'
                  setMode('fallback')
                  setShouldPlayVideo(false)
                })
              }}
              onEnded={finishIntro}
              onStalled={() => {
                document.documentElement.dataset.tooliaIntroMode = 'fallback'
                setMode('fallback')
                setShouldPlayVideo(false)
              }}
              onError={() => {
                document.documentElement.dataset.tooliaIntroMode = 'fallback'
                setMode('fallback')
                setShouldPlayVideo(false)
                const fallbackTimer = window.setTimeout(finishIntro, INTRO_FALLBACK_DURATION_MS)
                timersRef.current.push(fallbackTimer)
              }}
            />
          )}
        </div>
      )}
    </>
  )
}
