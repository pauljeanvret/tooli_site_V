import clsx, { type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price)
}

export const easeOutCubic = [0.22, 1, 0.36, 1]

export const transitionConfig = {
  standard: {
    duration: 0.2,
    ease: 'easeOut',
  },
  slow: {
    duration: 0.55,
    ease: easeOutCubic,
  },
}
