import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Toolia',
    short_name: 'Toolia',
    description:
      'Toolia trie vos emails Gmail, applique les bons labels et prépare vos brouillons de réponse. Vous gardez toujours le contrôle.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0B1020',
    theme_color: '#1F2A4D',
    icons: [
      {
        src: '/profile/logo_white_transparent.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/profile/logo_white_transparent.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
