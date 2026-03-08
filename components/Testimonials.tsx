'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card } from './Card'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

export const Testimonials: React.FC = () => {
  return (
    <Section id="testimonials" className="bg-gradient-to-b from-toolia-bg-secondary/40 via-toolia-bg-main to-toolia-bg-secondary/50">
      <div className="flex flex-col gap-16">
        {/* Title */}
        <ScrollReveal>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-toolia-text text-center max-w-3xl mx-auto">
            {copy.testimonials.title}
          </h2>
        </ScrollReveal>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {copy.testimonials.items.map((testimonial: any, idx: number) => (
            <ScrollReveal key={idx} delay={idx * 0.1}>
              <motion.div
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
              >
                <Card className="h-full flex flex-col gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-toolia-primary to-toolia-gradient-light flex items-center justify-center text-white font-bold">
                    {testimonial.initials}
                  </div>

                  {/* Quote */}
                  <p className="text-toolia-text italic">&quot;{testimonial.quote}&quot;</p>

                  {/* Author */}
                  <div className="border-t border-toolia-border-subtle pt-4 mt-auto">
                    <p className="font-semibold text-toolia-text">{testimonial.name}</p>
                    <p className="text-xs text-toolia-text-secondary">{testimonial.role}</p>
                  </div>
                </Card>
              </motion.div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </Section>
  )
}

Testimonials.displayName = 'Testimonials'
