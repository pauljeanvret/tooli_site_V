import type { Metadata } from 'next'

import { DiagnosticAdminClient } from '@/components/DiagnosticAdminClient'

export const metadata: Metadata = {
  title: 'Admin diagnostics | Toolia',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminDiagnosticsPage() {
  return <DiagnosticAdminClient />
}
