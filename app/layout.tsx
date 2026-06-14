import type { Metadata, Viewport } from 'next'
import { Inter, Manrope } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-heading',
  display: 'swap',
})

const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://toolia.tech'
const siteTitle = 'Toolia — Votre boîte mail se gère toute seule'
const siteDescription =
  'Toolia trie vos emails Gmail, applique les bons labels et prépare vos brouillons de réponse. Vous gardez toujours le contrôle.'
const logoUrl = '/profile/logo_white_transparent.png'

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  applicationName: 'Toolia',
  title: siteTitle,
  description: siteDescription,
  keywords: [
    'Toolia',
    'automatisation Gmail',
    'IA email',
    'brouillons Gmail',
    'gestion email',
    'productivité',
  ],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: logoUrl, type: 'image/png' }],
    apple: [{ url: logoUrl, type: 'image/png' }],
  },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: appUrl,
    siteName: 'Toolia',
    type: 'website',
    locale: 'fr_FR',
    images: [
      {
        url: logoUrl,
        width: 1536,
        height: 1024,
        alt: 'Toolia',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: siteDescription,
    images: [logoUrl],
  },
}

export const viewport: Viewport = {
  themeColor: '#1F2A4D',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${manrope.variable}`}>
      <head>
        <Script id="toolia-theme" strategy="beforeInteractive">
          {`
            try {
              var storedTheme = window.localStorage.getItem('toolia_theme') || 'light';
              var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
              var resolvedTheme = storedTheme === 'system' ? (prefersDark ? 'dark' : 'light') : storedTheme;
              document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
              document.documentElement.dataset.theme = storedTheme;
            } catch (error) {
              document.documentElement.dataset.theme = 'light';
            }
          `}
        </Script>
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
