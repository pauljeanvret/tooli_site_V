'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { Input } from './Input'
import { Textarea } from './Textarea'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

interface FormData {
  name: string
  email: string
  subject: string
  message: string
  consent: boolean
}

interface FormErrors {
  [key: string]: string
}

export const ContactForm: React.FC = () => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    consent: false,
  })

  const [errors, setErrors] = useState<FormErrors>({})
  const [isLoading, setIsLoading] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const validateForm = () => {
    const newErrors: FormErrors = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis.'
    }

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Veuillez entrer un email valide.'
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Le sujet est requis.'
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Le message est requis.'
    }

    if (!formData.consent) {
      newErrors.consent = 'Vous devez accepter d’être recontacté.'
    }

    return newErrors
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors = validateForm()

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const response = await fetch('https://formspree.io/f/xeelgpgq', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        throw new Error('Erreur lors de l’envoi')
      }

      setSuccessMessage(copy.contact.form.successMessage)
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
        consent: false,
      })
      setErrors({})

      setTimeout(() => {
        setSuccessMessage('')
      }, 5000)
    } catch {
      setErrorMessage(copy.contact.form.errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Section id="contact">
      <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-[0.86fr_1.14fr]">
        <ScrollReveal>
          <div className="flex max-w-xl flex-col gap-8">
            <div>
              <h2 className="font-heading mb-4 text-3xl font-extrabold tracking-[-0.035em] text-toolia-text md:text-4xl lg:text-5xl">
                {copy.contact.title}
              </h2>
              <p className="text-lg leading-8 text-toolia-text-secondary">
                {copy.contact.subtitle}
              </p>
            </div>

            <div className="space-y-3">
              {copy.contact.benefits.map((benefit, idx) => (
                <motion.div
                  key={idx}
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.1 }}
                  viewport={{ once: true }}
                >
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-toolia-success">
                    <Check size={16} className="text-white" />
                  </div>
                  <span className="text-toolia-text-secondary">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal>
          <Card className="flex flex-col gap-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label={copy.contact.form.nameLabel}
                  placeholder={copy.contact.form.namePlaceholder}
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  error={errors.name}
                />

                <Input
                  label={copy.contact.form.emailLabel}
                  placeholder={copy.contact.form.emailPlaceholder}
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  error={errors.email}
                />
              </div>

              <Input
                label={copy.contact.form.subjectLabel}
                placeholder={copy.contact.form.subjectPlaceholder}
                type="text"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                error={errors.subject}
              />

              <Textarea
                label={copy.contact.form.messageLabel}
                placeholder={copy.contact.form.messagePlaceholder}
                rows={6}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                error={errors.message}
              />

              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="mt-1 h-4 w-4 cursor-pointer rounded border border-toolia-border-subtle accent-toolia-primary"
                />
                <span className="text-sm text-toolia-text-secondary">
                  {copy.contact.form.checkboxLabel}
                </span>
              </label>
              {errors.consent && <p className="text-xs text-toolia-danger">{errors.consent}</p>}

              <Button type="submit" variant="primary" size="lg" isLoading={isLoading} disabled={isLoading} className="w-full">
                {isLoading ? copy.contact.form.loadingBtn : copy.contact.form.submitBtn}
              </Button>
            </form>

            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-2 rounded-card border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.1)] p-4 text-sm text-toolia-success"
                >
                  <Check size={18} />
                  {successMessage}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="rounded-card border border-[rgba(239,68,68,0.3)] bg-[rgba(239,68,68,0.1)] p-4 text-sm text-toolia-danger"
                >
                  {errorMessage}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </ScrollReveal>
      </div>
    </Section>
  )
}

ContactForm.displayName = 'ContactForm'
