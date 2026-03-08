'use client'

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { copy } from '@/lib/copy'

export const Footer: React.FC = () => {
  const handleSmoothScroll = (href: string) => {
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <footer className="w-full bg-toolia-bg-secondary border-t border-toolia-border-subtle py-12 md:py-16">
      <div className="max-w-layout mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <motion.div initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} viewport={{ once: true }}>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 rounded-full bg-toolia-primary flex items-center justify-center overflow-hidden">
                <Image 
                  src="/profile/logo_white_transparent.png" 
                  alt="Toolia" 
                  width={24} 
                  height={24}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="font-bold text-toolia-text">{copy.navbar.logo}</span>
            </div>
            <p className="text-sm text-toolia-text-secondary">{copy.footer.copyright}</p>
          </motion.div>

          {/* Links */}
          {[...Array(3)].map((_, colIdx) => (
            <motion.div
              key={colIdx}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: (colIdx + 1) * 0.1 }}
              viewport={{ once: true }}
            >
              <div className="space-y-3">
                {copy.footer.links.slice(colIdx * 2, (colIdx + 1) * 2).map((link) => (
                  <button
                    key={link.href}
                    onClick={() => handleSmoothScroll(link.href)}
                    className="block text-sm text-toolia-text-secondary hover:text-toolia-text transition-colors"
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Copyright */}
        <motion.div
          className="border-t border-toolia-border-subtle pt-8 text-center text-xs text-toolia-text-secondary"
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
