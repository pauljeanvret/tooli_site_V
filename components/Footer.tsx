'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { copy } from '@/lib/copy'

export const Footer: React.FC = () => {
  const handleSmoothScroll = (href: string) => {
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
      return
    }

    window.location.href = `/${href}`
  }

  return (
    <footer className="w-full border-t border-toolia-border-subtle bg-toolia-bg-secondary py-12 md:py-16">
      <div className="mx-auto max-w-layout px-6 md:px-8 xl:px-10">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} viewport={{ once: true }}>
            <Link href="/" className="mb-4 flex w-fit items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-toolia-primary">
                <Image
                  src="/profile/logo_white_transparent.png"
                  alt="Toolia"
                  width={24}
                  height={24}
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="font-bold text-toolia-text">{copy.navbar.logo}</span>
            </Link>
            <p className="max-w-xs text-sm leading-6 text-toolia-text-secondary">
              SaaS d’automatisation Gmail : labels, brouillons, alertes et contrôle humain.
            </p>
          </motion.div>

          {[...Array(3)].map((_, colIdx) => (
            <motion.div
              key={colIdx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: (colIdx + 1) * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="space-y-3">
                {copy.footer.links.slice(colIdx * 3, (colIdx + 1) * 3).map((link) =>
                  link.href.startsWith('#') ? (
                    <button
                      key={link.href}
                      onClick={() => handleSmoothScroll(link.href)}
                      className="block text-left text-sm text-toolia-text-secondary transition-colors hover:text-toolia-text"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="block text-sm text-toolia-text-secondary transition-colors hover:text-toolia-text"
                    >
                      {link.label}
                    </Link>
                  ),
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-12 border-t border-toolia-border-subtle pt-8 text-center text-xs text-toolia-text-secondary"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          viewport={{ once: true }}
        >
          <p>{copy.footer.copyright}</p>
        </motion.div>
      </div>
    </footer>
  )
}

Footer.displayName = 'Footer'
