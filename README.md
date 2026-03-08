# Toolia Landing Page

Une landing page premium pour **Toolia** - l'outil IA qui gère vos emails pour vous.

## 🚀 Installation Rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Lancer le serveur de développement
npm run dev

# 3. Ouvrir le site
# http://localhost:3000
```

## 📁 Structure du Projet

```
site-main/
├── app/
│   ├── api/
│   │   └── lead/
│   │       └── route.ts          # API endpoint pour les formulaires
│   ├── layout.tsx                # Layout principal
│   ├── page.tsx                  # Page landing
│   ├── globals.css               # Styles globaux
│   └── favicon.ico
├── components/
│   ├── Button.tsx                # Composant bouton réutilisable
│   ├── Card.tsx                  # Composant carte
│   ├── Badge.tsx                 # Composant badge
│   ├── Input.tsx, Select.tsx, Textarea.tsx  # Composants formulaire
│   ├── Section.tsx               # Wrapper de section avec id
│   ├── ScrollReveal.tsx          # Animation scroll reveal
│   ├── Glow.tsx                  # Effets de glow
│   ├── Navbar.tsx                # Barre de navigation sticky
│   ├── Hero.tsx                  # Section hero
│   ├── Values.tsx                # Section valeurs (3 cartes)
│   ├── ProductShowcase.tsx       # Section offres/pricing
│   ├── HowItWorks.tsx            # Section comment ça marche
│   ├── Stats.tsx                 # Section statistiques
│   ├── Testimonials.tsx          # Section témoignages
│   ├── FAQ.tsx                   # Section FAQ
│   ├── ContactForm.tsx           # Formulaire contact
│   └── Footer.tsx                # Pied de page
├── lib/
│   ├── copy.ts                   # Tous les textes centralisés
│   └── utils.ts                  # Helpers (cn, clsx, tailwind-merge)
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── next.config.js
└── README.md
```

## 🎨 Couleurs & Personnalisation

Les couleurs sont définies dans `tailwind.config.js` et utilisées dans les composants:

```javascript
// Couleurs principales
'toolia-blue': '#4F7CFF'      // Bleu primaire (boutons, accents)
'toolia-cyan': '#22D3EE'      // Cyan (effet glow)
'toolia-bg': '#F7F8FC'        // Fond page
'toolia-text': '#0B1220'      // Texte principal
'toolia-text-secondary': '#334155'  // Texte secondaire
'toolia-success': '#22C55E'   // Vert (succès)
'toolia-danger': '#EF4444'    // Rouge (erreurs)
'toolia-warning': '#F59E0B'   // Orange
```

## ✏️ Changer les Textes

Tous les textes de la landing sont centralisés dans [lib/copy.ts](lib/copy.ts). Modifiez les strings directement dans ce fichier:

```typescript
export const copy = {
  navbar: { ... },
  hero: { title: 'Votre texte ici' },
  values: { ... },
  // etc.
}
```

## 🔧 Configurer le Formulaire

Le formulaire envoie un POST à `/api/lead`. Actuellement, il loggue en console.

### Pour utiliser **Resend** (recommandé):

1. Installer Resend: `npm install resend`
2. Ajouter votre clé API dans `.env.local`:
   ```
   RESEND_API_KEY=re_xxxxx
   ```
3. Mettre à jour `app/api/lead/route.ts`:
   ```typescript
   import { Resend } from 'resend'
   
   const resend = new Resend(process.env.RESEND_API_KEY)
   
   export async function POST(request: NextRequest) {
     const body = await request.json()
     
     await resend.emails.send({
       from: 'demo@toolia.app',
       to: 'you@example.com',
       subject: `Nouvelle démo: ${body.name}`,
       html: `<p>${JSON.stringify(body)}</p>`,
     })
   
     return NextResponse.json({ success: true })
   }
   ```

### Pour utiliser **Form Spree** ou autre service:

Modifier `app/api/lead/route.ts` pour appeler l'API du service.

## 🎬 Animations

- **Scroll Reveal**: Les sections apparaissent en scrollant avec fade + translateY
- **Hover Effects**: Lift léger sur les cartes et boutons
- **Loading State**: Spinner sur le bouton du formulaire
- **Transitions**: Courbes douces (easeOut), durées 200-550ms

Tous les timings sont étudiés pour un ressenti premium.

## ♿ Accessibilité

✅ Focus rings visibles  
✅ Contrastes suffisants  
✅ Labels sur inputs  
✅ Navigation clavier OK  
✅ Support `prefers-reduced-motion`

## 📱 Responsive

- **Mobile**: Optimisé pour 375px+
- **Tablet**: Changements de layout à 768px
- **Desktop**: Layout à 3 colonnes, max-width 1200px

## 🚀 Build & Deploy

```bash
# Build pour production
npm run build

# Tester le build
npm start
```

Déployer sur **Vercel** (recommandé pour Next.js):
```bash
npm install -g vercel
vercel
```

## 📝 Licence

Propriétaire - Toolia 2024

---

**Questions?** Consultez [Framer Motion](https://www.framer.com/motion/) et [Next.js Docs](https://nextjs.org/docs).