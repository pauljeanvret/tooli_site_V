'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Button } from './Button'
import { Badge } from './Badge'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { Glow } from './Glow'
import { copy } from '@/lib/copy'

export const Hero: React.FC = () => {
  const handleSmoothScroll = (href: string) => {
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  // Small realistic Gmail-like mock data (4 emails)
  const gmailMock = [
    { from: 'Sarah Martin', subject: 'Budget restockage Q2', preview: "Bonjour Paul, voici...", time: '09:12', label: 'Clients', labelColor: 'bg-blue-100 text-blue-800' },
    { from: 'Nike Partnerships', subject: 'Partenariat brand 2026', preview: 'Bonjour Paul, nous...', time: '11:03', label: 'Sponsoring', labelColor: 'bg-green-100 text-green-800' },
    { from: 'Stripe', subject: 'Paiement facture #2034', preview: 'Votre facture de...', time: '14:20', label: 'Factures', labelColor: 'bg-red-100 text-red-800' },
    { from: 'Acme Corp', subject: 'Nouveau contrat signé', preview: 'Intéressés par...', time: '16:45', label: 'Clients', labelColor: 'bg-blue-100 text-blue-800' },
  ]

  return (
    <div id="hero" className="relative bg-gradient-to-b from-toolia-bg-main via-toolia-bg-main to-toolia-bg-secondary/60 pt-32 md:pt-40 pb-20 md:pb-0 overflow-hidden">
      {/* Blobs */}
      <Glow className="top-20 -left-20 w-80 h-80 md:w-96 md:h-96 lg:w-full lg:h-full 2xl:w-screen 2xl:h-screen" color="primary" blur="lg" />
      <Glow className="bottom-40 -right-20 w-96 h-96 md:w-full md:h-full lg:w-screen lg:h-screen 2xl:w-full 2xl:h-full" color="primary" blur="lg" />

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 lg:gap-16 items-center min-h-[calc(100vh-200px)] max-w-7xl 3xl:max-w-6xl 4xl:max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Left Content */}
        <ScrollReveal className="flex flex-col gap-6 md:gap-8">
          {/* Badge */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="primary" size="sm">
              {copy.hero.badge}
            </Badge>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="text-4xl sm:text-5xl md:text-5xl lg:text-6xl 2xl:text-7xl 3xl:text-8xl font-bold text-toolia-text leading-tight"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            {copy.hero.title}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            className="text-lg md:text-xl text-toolia-text-secondary leading-relaxed"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {copy.hero.subtitle}
          </motion.p>

          {/* Proofs */}
          <motion.div
            className="flex flex-col md:flex-row gap-4 md:gap-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            {copy.hero.proofs.map((proof, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-toolia-text-secondary">
                <div className="w-1.5 h-1.5 rounded-full bg-toolia-primary" />
                {proof}
              </div>
            ))}
          </motion.div>

          {/* CTAs */}
          <motion.div
            className="flex flex-col sm:flex-row gap-4 pt-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => handleSmoothScroll('#contact')}
              className="sm:w-auto"
            >
              {copy.hero.cta1}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => handleSmoothScroll('#how')}
              className="sm:w-auto"
            >
              {copy.hero.cta2}
            </Button>
          </motion.div>

          {/* Sub CTA */}
          <motion.p
            className="text-xs text-toolia-text-secondary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            {copy.hero.subCta}
          </motion.p>
        </ScrollReveal>

        {/* Right - Gmail Mockup */}
        <div className="relative hidden lg:flex justify-center items-center min-h-[600px] 2xl:min-h-[700px] 3xl:min-h-[800px]">
          <motion.div
            className="w-full max-w-md md:max-w-lg lg:max-w-xl 2xl:max-w-2xl 3xl:max-w-3xl"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {/* Gmail Card - White background with real colors */}
            <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex h-auto md:h-72 lg:h-80 2xl:h-96 3xl:h-full max-h-screen">
              {/* LEFT SIDEBAR */}
              <aside className="w-32 bg-gray-50 border-r border-gray-200 p-2 flex flex-col">
                {/* Compose Button */}
                <button className="w-full bg-blue-500 text-white text-xs font-medium py-1.5 px-2 rounded-full mb-2 shadow">
                  ✎ Compose
                </button>

                {/* Main Folders */}
                <nav className="text-xs mb-3 space-y-0.5 flex-1">
                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-gray-100 font-medium text-gray-800">
                    <span>📥</span>
                    <span>Inbox</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded text-gray-700">
                    <span>⭐</span>
                    <span>Starred</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded text-gray-700">
                    <span>🕐</span>
                    <span>Snoozed</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded text-gray-700">
                    <span>📤</span>
                    <span>Sent</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded text-gray-700">
                    <span>📝</span>
                    <span>Drafts</span>
                  </div>
                </nav>

                {/* Labels Section */}
                <div className="border-t border-gray-200 pt-2">
                  <p className="text-xs font-semibold text-gray-500 px-2 mb-1">LABELS</p>
                  <ul className="text-xs space-y-0.5">
                    <li className="flex items-center gap-1.5 px-2 py-0.5 rounded text-gray-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      <span>Clients</span>
                    </li>
                    <li className="flex items-center gap-1.5 px-2 py-0.5 rounded text-gray-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500"></span>
                      <span>Sponsoring</span>
                    </li>
                    <li className="flex items-center gap-1.5 px-2 py-0.5 rounded text-gray-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
                      <span>Factures</span>
                    </li>
                    <li className="flex items-center gap-1.5 px-2 py-0.5 rounded text-gray-700">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                      <span>Emails</span>
                    </li>
                  </ul>
                </div>
              </aside>

              {/* MAIN EMAILS LIST */}
              <main className="flex-1 bg-white overflow-y-auto">
                {/* Email header */}
                <div className="flex items-center gap-2 px-2 py-1 border-b border-gray-200 bg-gray-50 sticky top-0">
                  <span className="text-xs text-gray-600">⚙️</span>
                </div>

                {/* Email List */}
                <div className="divide-y divide-gray-100">
                  {gmailMock.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 px-2 py-2 border-l-4 border-transparent">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {m.from.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1">
                          <p className="text-xs font-medium text-gray-900 truncate">{m.from}</p>
                          <span className="text-xs text-gray-500 flex-shrink-0">{m.time}</span>
                        </div>
                        <p className="text-xs font-medium text-gray-800">{m.subject}</p>
                        <p className="text-xs text-gray-600 truncate">{m.preview}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {/* Label badge */}
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${m.labelColor}`}>
                          {m.label}
                        </span>
                        {/* Draft text */}
                        <span className="text-xs text-gray-500 font-medium">draft</span>
                      </div>
                    </div>
                  ))}
                </div>
              </main>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

