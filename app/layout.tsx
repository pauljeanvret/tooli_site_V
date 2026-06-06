import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://toolia.tech'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: 'Toolia — Automatisation Gmail avec contrôle humain',
  description:
    'Toolia trie, priorise et prépare vos brouillons dans Gmail. Vous gardez la validation finale, Toolia s’occupe du répétitif.',
  keywords: [
    'Toolia',
    'automatisation Gmail',
    'IA email',
    'brouillons Gmail',
    'gestion email',
    'productivité',
  ],
  openGraph: {
    title: 'Toolia — Automatisation Gmail avec contrôle humain',
    description:
      'Connectez Gmail, configurez vos règles, laissez Toolia classer les emails et préparer les brouillons à valider.',
    url: appUrl,
    siteName: 'Toolia',
    type: 'website',
    locale: 'fr_FR',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Toolia — Automatisation Gmail avec contrôle humain',
    description:
      'Toolia trie, priorise et prépare vos brouillons dans Gmail. Vous gardez la main.',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        <meta name="theme-color" content="#1F2A4D" />
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-JF98EYE0Q0"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-JF98EYE0Q0');
          `}
        </Script>
      </head>
      <body className="bg-toolia-bg-main text-toolia-text">
        <Navbar />
        <main className="pt-18">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
