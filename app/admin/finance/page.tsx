import type { Metadata } from 'next'

import { AdminFinanceClient } from '@/components/AdminFinanceClient'

export const metadata: Metadata = {
  title: 'Admin finance | Toolia',
  robots: {
    index: false,
    follow: false,
  },
}

export default function AdminFinancePage() {
  return <AdminFinanceClient />
}
