'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Menu, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from './Button'
import { copy } from '@/lib/copy'

export const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)

  const handleSmoothScroll = (href: string) => {
    const target = document.querySelector(href)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' })
      setIsOpen(false)
    }
  }

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-18 border-b border-toolia-border-subtle bg-toolia-bg-main/80 backdrop-blur-navbar">
        <div className="max-w-layout mx-auto px-6 md:px-8 h-full flex items-center justify-between">
          {/* Logo */}
          <motion.div className="flex items-center gap-2 font-bold text-lg" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
            <div className="w-8 h-8 rounded-full bg-toolia-primary flex items-center justify-center overflow-hidden">
              <Image 
                src="/profile/logo_white_transparent.png" 
                alt="Toolia" 
                width={32} 
                height={32}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-toolia-text">{copy.navbar.logo}</span>
          </motion.div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {copy.navbar.nav.map((link, idx) => (
              <motion.button
                key={link.href}
                onClick={() => handleSmoothScroll(link.href)}
                className="text-toolia-text-secondary hover:text-toolia-text transition-colors duration-200 relative font-medium text-sm"
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
          </div>

          {/* Desktop CTA */}
          <div className="hidden md:block">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleSmoothScroll('#contact')}
              className="whitespace-nowrap"
            >
              {copy.navbar.cta}
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-toolia-text hover:text-toolia-primary transition-colors"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="fixed inset-0 top-18 z-40 md:hidden bg-toolia-bg-secondary border-t border-toolia-border-subtle"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex flex-col p-6 gap-4">
              {copy.navbar.nav.map((link) => (
                <button
                  key={link.href}
                  onClick={() => handleSmoothScroll(link.href)}
                  className="text-left text-toolia-text-secondary hover:text-toolia-text transition-colors py-3 font-medium"
                >
                  {link.label}
                </button>
              ))}
              <div className="border-t border-toolia-border-subtle pt-4 mt-4">
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleSmoothScroll('#contact')}
                  className="w-full"
                >
                  {copy.navbar.cta}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

Navbar.displayName = 'Navbar'
