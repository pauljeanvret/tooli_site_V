'use client'

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'

export const Behind: React.FC = () => {
  return (
    <Section id="behind" className="bg-gradient-to-b from-toolia-bg-secondary/50 via-toolia-bg-main to-toolia-bg-secondary/40">
      <div className="flex flex-col gap-12 max-w-3xl mx-auto">
        {/* Title */}
        <ScrollReveal>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-toolia-text">
            Derrière Toolia
          </h2>
        </ScrollReveal>

        {/* Content */}
        <div className="flex flex-col md:flex-row gap-8 md:gap-12 items-start">
          {/* Profile Image */}
          <ScrollReveal className="flex-shrink-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-2 border-toolia-border-subtle shadow-lg"
            >
              <Image
                src="/profile/paul.jpg"
                alt="Paul, fondateur de Toolia"
                width={160}
                height={160}
                className="w-full h-full object-cover object-center"
                priority
              />
            </motion.div>
          </ScrollReveal>

          {/* Text Content */}
          <ScrollReveal className="flex-1">
            <div className="space-y-6">
              <div>
                <p className="text-toolia-text leading-relaxed">
                  Toolia a été créé par <span className="font-semibold">Paul</span>, passionné d'automatisation et d'IA appliquée au business.
                </p>
              </div>

              <div>
                <p className="text-toolia-text leading-relaxed">
                  L'objectif est simple : aider les entrepreneurs et dirigeants à <span className="font-semibold">gagner du temps</span>, sans perdre le contrôle de leur boîte mail.
                </p>
              </div>

              <div>
                <p className="text-toolia-text leading-relaxed">
                  Chaque client est accompagné personnellement, avec une configuration adaptée à ses besoins réels, pas une solution générique.
                </p>
              </div>

              <div className="pt-4 border-t border-toolia-border-subtle">
                <p className="text-toolia-text-secondary text-sm italic leading-relaxed">
                  « Toolia, ce n'est pas un outil de plus. C'est un partenaire pour booster votre efficacité. »
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </Section>
  )
}
