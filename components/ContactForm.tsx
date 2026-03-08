'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { Input } from './Input'
import { Select } from './Select'
import { Textarea } from './Textarea'
import { Section } from './Section'
import { ScrollReveal } from './ScrollReveal'
import { copy } from '@/lib/copy'

interface FormData {
  name: string
  email: string
  volume: string
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
    volume: '<20',
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
      newErrors.name = 'Le nom est requis'
    }

    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Veuillez entrer un email valide'
    }

    if (!formData.consent) {
      newErrors.consent = 'Vous devez accepter d\'être recontacté'
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
        throw new Error('Erreur lors de l\'envoi')
      }

      setSuccessMessage(copy.contact.form.successMessage)
      setFormData({
        name: '',
        email: '',
        volume: '<20',
        message: '',
        consent: false,
      })
      setErrors({})

      setTimeout(() => {
        setSuccessMessage('')
      }, 5000)
    } catch (error) {
      setErrorMessage(copy.contact.form.errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Section id="contact" className="bg-gradient-to-b from-toolia-bg-secondary/55 via-toolia-bg-main to-toolia-bg-secondary/80">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Left - Benefits */}
        <ScrollReveal>
          <div className="flex flex-col gap-8">
            <div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold text-toolia-text mb-4">
                {copy.contact.title}
              </h2>
              <p className="text-lg text-toolia-text-secondary">
                {copy.contact.subtitle}
              </p>
            </div>

            {/* Benefits Checklist */}
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
                  <div className="w-6 h-6 rounded-full bg-toolia-success flex items-center justify-center flex-shrink-0">
                    <Check size={16} className="text-white" />
                  </div>
                  <span className="text-toolia-text-secondary">{benefit}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* Right - Form */}
        <ScrollReveal>
          <Card className="flex flex-col gap-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Name */}
              <Input
                label={copy.contact.form.nameLabel}
                placeholder={copy.contact.form.namePlaceholder}
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                error={errors.name}
              />

              {/* Email */}
              <Input
                label={copy.contact.form.emailLabel}
                placeholder={copy.contact.form.emailPlaceholder}
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                error={errors.email}
              />

              {/* Volume */}
              <Select
                label={copy.contact.form.volumeLabel}
                value={formData.volume}
                onChange={(e) => setFormData({ ...formData, volume: e.target.value })}
                options={copy.contact.form.volumeOptions}
              />

              {/* Message */}
              <Textarea
                label={copy.contact.form.messageLabel}
                placeholder={copy.contact.form.messagePlaceholder}
                rows={4}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              />

              {/* Consent Checkbox */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consent}
                  onChange={(e) => setFormData({ ...formData, consent: e.target.checked })}
                  className="w-4 h-4 mt-1 rounded border border-toolia-border-subtle accent-toolia-primary cursor-pointer"
                />
                <span className="text-sm text-toolia-text-secondary">
                  {copy.contact.form.checkboxLabel}
                </span>
              </label>
              {errors.consent && (
                <p className="text-xs text-toolia-danger">{errors.consent}</p>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isLoading}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading
                  ? copy.contact.form.loadingBtn
                  : copy.contact.form.submitBtn}
              </Button>
            </form>

            {/* Success Message */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-[rgba(34,197,94,0.1)] border border-[rgba(34,197,94,0.3)] rounded-card text-sm text-toolia-success flex items-center gap-2"
                >
                  <Check size={18} />
                  {successMessage}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error Message */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="p-4 bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] rounded-card text-sm text-toolia-danger"
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
