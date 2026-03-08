'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

interface FAQItem {
  question: string
  answer: string
  open?: boolean
}

export const FAQ: React.FC = () => {
  const [items, setItems] = useState<FAQItem[]>(
    copy.faq.items.map((item) => ({
      ...item,
      open: false,
    }))
  )

  const toggleItem = (idx: number) => {
    setItems(
      items.map((item, i) => ({
        ...item,
        open: i === idx ? !item.open : false,
      }))
    )
  }

  return (
    <Section id="faq" className="bg-gradient-to-b from-toolia-bg-secondary/50 via-toolia-bg-main to-toolia-bg-secondary/55">
      <div className="flex flex-col gap-16">
        {/* Title */}
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-toolia-text text-center">
            {copy.faq.title}
          </h2>
        </ScrollReveal>

        {/* FAQ List */}
        <div className="max-w-3xl mx-auto w-full space-y-4">
          {items.map((item, idx) => (
            <ScrollReveal key={idx} delay={idx * 0.08}>
              <motion.div
                className="border border-toolia-border-subtle rounded-card overflow-hidden"
                layout
              >
                <button
                  onClick={() => toggleItem(idx)}
                  className="w-full px-6 py-4 text-left font-medium text-toolia-text hover:bg-toolia-card-hover/50 transition-colors duration-200 flex items-center justify-between gap-4"
                  aria-expanded={item.open}
                >
                  <span>{item.question}</span>
                  <motion.div
                    animate={{ rotate: item.open ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-shrink-0"
                  >
                    <ChevronDown size={20} className="text-toolia-primary" />
                  </motion.div>
                </button>

                <AnimatePresence>
                  {item.open && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-6 py-4 bg-toolia-card-hover/50 border-t border-toolia-border-subtle">
                        <p className="text-toolia-text-secondary text-sm leading-relaxed">
                          {item.answer}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </Section>
  )
}

FAQ.displayName = 'FAQ'
