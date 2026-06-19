import type { Metadata } from 'next'

import { DiagnosticClient } from '@/components/DiagnosticClient'

export const metadata: Metadata = {
  title: 'Diagnostic Gmail gratuit | Toolia',
  description:
    'Estimez le temps et le coût que votre boîte Gmail vous fait perdre, puis découvrez l’offre Toolia la plus adaptée.',
}

export default function DiagnosticPage() {
  return <DiagnosticClient />
}
