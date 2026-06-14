'use client'

import React from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'

export const Behind: React.FC = () => {
  return (
    <Section id="behind">
      <div className="mx-auto flex max-w-4xl flex-col gap-12">
        <ScrollReveal>
          <h2 className="font-heading text-2xl font-extrabold tracking-[-0.03em] text-toolia-text md:text-3xl lg:text-4xl">
            Derrière Toolia
          </h2>
        </ScrollReveal>

        <div className="flex flex-col items-start gap-8 md:flex-row md:gap-12">
          <ScrollReveal className="flex-shrink-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
              className="h-32 w-32 overflow-hidden rounded-full border-2 border-toolia-border-subtle shadow-lg md:h-40 md:w-40"
            >
              <Image
                src="/profile/paul.jpg"
                alt="Paul, fondateur de Toolia"
                width={160}
                height={160}
                className="h-full w-full object-cover object-center"
                priority
              />
            </motion.div>
          </ScrollReveal>

          <ScrollReveal className="flex-1">
            <div className="space-y-6">
              <p className="leading-relaxed text-toolia-text">
                Toolia a été créé par <span className="font-semibold">Paul</span>, avec une idée simple :
                rendre l’automatisation Gmail utile, lisible et contrôlable.
              </p>

              <p className="leading-relaxed text-toolia-text">
                Le produit aide les professionnels à traiter plus vite les emails répétitifs, sans confier
                aveuglément l’envoi de leurs réponses à une IA.
              </p>

              <p className="leading-relaxed text-toolia-text">
                La priorité de Toolia : vous faire gagner du temps tout en gardant Gmail comme espace de travail
                principal et la validation finale entre vos mains.
              </p>

              <div className="border-t border-toolia-border-subtle pt-4">
                <p className="text-sm italic leading-relaxed text-toolia-text-secondary">
                  « Moins d’opérations répétitives, plus de contrôle sur ce qui compte vraiment. »
                </p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </Section>
  )
}
