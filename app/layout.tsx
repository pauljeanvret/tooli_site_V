import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Footer } from '@/components/Footer'
import Script from "next/script"

export const metadata: Metadata = {
  title: 'Toolia - Votre boîte mail se gère toute seule',
  description:
    'Toolia trie, priorise et prépare des réponses. Vous validez. C\'est tout. Gagnez 5-10h par semaine.',
  keywords: [
    'Email management',
    'AI email',
    'Gmail automation',
    'Email automation',
    'Productivity',
    'Toolia',
  ],
  openGraph: {
    title: 'Toolia - Votre boîte mail se gère toute seule',
    description:
      'Toolia trie, priorise et prépare des réponses. Vous validez. C\'est tout. Gagnez 5-10h par semaine.',
    type: 'website',
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
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#4F7CFF" />
        {/* Google tag (gtag.js) */}
        <Script
  src="https://www.googletagmanager.com/gtag/js?id=G-JF98EYEQ00"
  strategy="afterInteractive"
/>

<Script id="google-analytics" strategy="afterInteractive">
  {`
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-JF98EYEQ00');
  `}
</Script> 
      </head>
      <body className="bg-toolia-bg text-toolia-text">
        <Navbar />
        <main className="pt-18">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  )
}
