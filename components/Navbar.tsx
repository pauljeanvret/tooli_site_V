'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './Button'
import { copy } from '@/lib/copy'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

type NavbarAccount = {
  name: string
  email: string
}

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [account, setAccount] = useState<NavbarAccount | null>(null)

  React.useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const setAccountFromUser = (user: { email?: string | null; user_metadata?: unknown } | null | undefined) => {
      if (!user?.email) {
        setAccount(null)
        return
      }

      const metadata = user.user_metadata as { full_name?: string; name?: string } | null
      setAccount({
        name: metadata?.full_name || metadata?.name || user.email.split('@')[0],
        email: user.email,
      })
    }

    void supabase.auth.getUser().then(({ data }) => setAccountFromUser(data.user))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAccountFromUser(session?.user)
    })

    return () => {
      data.subscription.unsubscribe()
    }
  }, [])

  const logout = async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase?.auth.signOut()
    ;[
      'toolia_demo_session',
      'toolia_selected_plan',
      'toolia_onboarding_answers',
      'toolia_gmail_connection',
      'toolia_automation_profile',
      'toolia_dashboard_state',
      'toolia_generation_done',
    ].forEach((key) => window.localStorage.removeItem(key))
    setAccount(null)
    setAccountMenuOpen(false)
    setIsOpen(false)
    window.location.href = '/'
  }

  const profileInitial = (account?.name || account?.email || 'T').slice(0, 1).toUpperCase()

  const handleSmoothScroll = (href: string) => {
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
      setIsOpen(false)
    } else {
      window.location.href = `/${href}`
    }
  }

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-50 h-18 border-b border-toolia-border-subtle bg-toolia-bg-main/80 backdrop-blur-navbar">
        <div className="mx-auto flex h-full max-w-layout items-center justify-between px-6 md:px-8 xl:px-10">
          <motion.div className="font-bold text-lg" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <button
              type="button"
              onClick={() => {
                window.location.href = '/'
              }}
              className="flex items-center gap-2"
              aria-label="Retour à l’accueil Toolia"
            >
              <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-toolia-primary">
                <Image
                  src="/profile/logo_white_transparent.png"
                  alt="Toolia"
                  width={32}
                  height={32}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-toolia-text">{copy.navbar.logo}</span>
            </button>
          </motion.div>

          <div className="hidden items-center gap-6 md:flex">
            {copy.navbar.nav.map((link, idx) => (
              <motion.button
                key={link.href}
                onClick={() => handleSmoothScroll(link.href)}
                className="relative text-sm font-medium text-toolia-text-secondary transition-colors duration-200 hover:text-toolia-text"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
              >
                {link.label}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-toolia-primary"
                  initial={{ scaleX: 0, originX: 'left' }}
                  whileHover={{ scaleX: 1 }}
                  transition={{ duration: 0.3 }}
                />
              </motion.button>
            ))}
            {!account && (
              <motion.button
                onClick={() => {
                  window.location.href = '/login'
                }}
                className="relative text-sm font-medium text-toolia-text-secondary transition-colors duration-200 hover:text-toolia-text"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: copy.navbar.nav.length * 0.05 }}
              >
                Se connecter
              </motion.button>
            )}
          </div>

          <div className="hidden md:block">
            {account ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen((current) => !current)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-toolia-border-subtle bg-toolia-card-hover text-sm font-bold text-toolia-text transition hover:border-toolia-primary"
                  aria-label="Menu compte"
                >
                  {profileInitial}
                </button>
                {accountMenuOpen && (
                  <div className="absolute right-0 mt-3 w-56 overflow-hidden rounded-card border border-toolia-border-subtle bg-toolia-bg-secondary shadow-xl">
                    <div className="border-b border-toolia-border-subtle px-4 py-3">
                      <p className="truncate text-sm font-semibold text-toolia-text">{account.name}</p>
                      <p className="truncate text-xs text-toolia-text-secondary">{account.email}</p>
                    </div>
                    <button className="block w-full px-4 py-3 text-left text-sm text-toolia-text-secondary hover:bg-toolia-card-hover hover:text-toolia-text" onClick={() => { window.location.href = '/dashboard' }}>
                      Mon espace Toolia
                    </button>
                    <button className="block w-full px-4 py-3 text-left text-sm text-toolia-text-secondary hover:bg-toolia-card-hover hover:text-toolia-text" onClick={() => { window.location.href = '/dashboard' }}>
                      Mon automatisation
                    </button>
                    <button className="block w-full px-4 py-3 text-left text-sm text-toolia-text-secondary hover:bg-toolia-card-hover hover:text-toolia-text" onClick={() => { window.location.href = '/dashboard/settings' }}>
                      Paramètres
                    </button>
                    <button className="block w-full px-4 py-3 text-left text-sm text-toolia-text-secondary hover:bg-toolia-card-hover hover:text-toolia-text" onClick={logout}>
                      Se déconnecter
                    </button>
                    <button className="block w-full px-4 py-3 text-left text-sm text-toolia-danger hover:bg-toolia-card-hover" onClick={() => { window.location.href = '/dashboard/settings#delete-account' }}>
                      Supprimer mon compte
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  window.location.href = '/signup'
                }}
                className="whitespace-nowrap"
              >
                {copy.navbar.cta}
              </Button>
            )}
          </div>

          <button
            className="text-toolia-text transition-colors hover:text-toolia-primary md:hidden"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Ouvrir le menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 top-18 z-40 border-t border-toolia-border-subtle bg-toolia-bg-secondary md:hidden"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col gap-4 p-6">
              {copy.navbar.nav.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleSmoothScroll(link.href)}
                  className="py-3 text-left font-medium text-toolia-text-secondary transition-colors hover:text-toolia-text"
                >
                  {link.label}
                </button>
              ))}
              {account ? (
                <div className="mt-4 flex flex-col gap-3 border-t border-toolia-border-subtle pt-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full border border-toolia-border-subtle bg-toolia-card-hover text-sm font-bold text-toolia-text">
                      {profileInitial}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-toolia-text">{account.name}</p>
                      <p className="truncate text-xs text-toolia-text-secondary">{account.email}</p>
                    </div>
                  </div>
                  <button className="py-2 text-left font-medium text-toolia-text-secondary transition-colors hover:text-toolia-text" onClick={() => { window.location.href = '/dashboard' }}>
                    Mon espace Toolia
                  </button>
                  <button className="py-2 text-left font-medium text-toolia-text-secondary transition-colors hover:text-toolia-text" onClick={() => { window.location.href = '/dashboard' }}>
                    Mon automatisation
                  </button>
                  <button className="py-2 text-left font-medium text-toolia-text-secondary transition-colors hover:text-toolia-text" onClick={() => { window.location.href = '/dashboard/settings' }}>
                    Paramètres
                  </button>
                  <button className="py-2 text-left font-medium text-toolia-text-secondary transition-colors hover:text-toolia-text" onClick={logout}>
                    Se déconnecter
                  </button>
                  <button className="py-2 text-left font-medium text-toolia-danger transition-colors" onClick={() => { window.location.href = '/dashboard/settings#delete-account' }}>
                    Supprimer mon compte
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => {
                      window.location.href = '/login'
                    }}
                    className="py-3 text-left font-medium text-toolia-text-secondary transition-colors hover:text-toolia-text"
                  >
                    Se connecter
                  </button>
                  <div className="mt-4 border-t border-toolia-border-subtle pt-4">
                    <Button
                      variant="primary"
                      size="md"
                      onClick={() => {
                        window.location.href = '/signup'
                      }}
                      className="w-full"
                    >
                      {copy.navbar.cta}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

Navbar.displayName = 'Navbar'
