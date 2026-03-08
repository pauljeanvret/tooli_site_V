// Centralized copy for the entire site
export const copy = {
  // Navbar
  navbar: {
    logo: 'Toolia',
    nav: [
      { label: 'Produit', href: '#product' },
      { label: 'Offres', href: '#pricing' },
      { label: 'Comment ça marche', href: '#how' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Contact', href: '#contact' },
    ],
    cta: 'Automatiser ma boîte mail',
  },

  // Hero
  hero: {
    badge: 'IA Gmail • Gain de temps',
    title: 'Votre boîte mail se gère toute seule.',
    subtitle: 'Toolia trie, priorise et prépare des réponses. Vous validez. C\'est tout.',
    proofs: [
      'Mise en place: 24–48h',
      'Contrôle total',
      'Confidentiel',
    ],
    cta1: 'Automatiser ma boîte mail',
    cta2: 'Voir comment ça marche',
    subCta: 'Réponse sous 24h • Sans engagement',
    mockupTitle: 'Inbox',
    mockupEmails: [
      { from: 'Sarah Martin', subject: 'Présentation SAAS', tag: 'Urgent' },
      { from: 'Jean Dupont', subject: 'Contrat à signer', tag: 'À traiter' },
      { from: 'Newsletter', subject: 'Votre digeste hebdo', tag: 'À archiver' },
    ],
    draftReady: 'Brouillon prêt',
    timeSaved: 'Temps économisé aujourd\'hui: 42 min',
  },

  // Values
  values: {
    title: 'Conçu pour vous faire gagner du temps, sans perdre le contrôle.',
    items: [
      {
        title: 'Gain de temps',
        description: 'Tri + priorités + réponses préparées.',
        icon: 'Zap',
      },
      {
        title: 'Contrôle',
        description: 'Vous validez avant envoi/archivage.',
        icon: 'Shield',
      },
      {
        title: 'Confidentialité',
        description: 'Approche responsable + minimisation des données.',
        icon: 'Lock',
      },
    ],
  },

  // Pricing
  pricing: {
    title: 'Des offres simples. Un vrai gain de temps.',
    disclaimer: 'Le tarif dépend de vos besoins, du volume d\'emails et du niveau de personnalisation.',
    plans: [
      {
        name: 'Essentiel',
        description: 'Parfait pour débuter',
        setup: '299€',
        setupLabel: 'Setup',
        price: '59€ – 99€',
        period: '/mois',
        features: [
          'Tri automatique des emails',
          'Jusqu\'à 5 catégories personnalisées',
          'Réponses simples pré-rédigées',
          'Archivage intelligent',
          'Installation rapide',
          'Support standard',
        ],
        cta: 'Voir les détails du pack',
        featured: false,
      },
      {
        name: 'Pro',
        description: 'Le plus populaire',
        setup: '499€',
        setupLabel: 'Setup',
        price: '109€ – 139€',
        period: '/mois',
        features: [
          'Tout Essentiel',
          'Jusqu\'à 10 catégories personnalisées',
          'Réponses plus intelligentes',
          'Brouillons optimisés',
          'Relances automatiques',
          'Paramétrage avancé',
        ],
        cta: 'Voir les détails du pack',
        featured: true,
      },
      {
        name: 'Premium',
        description: 'Pour les équipes',
        setup: '999€',
        setupLabel: 'Setup',
        price: '169€ – 229€',
        period: '/mois',
        features: [
          'Tout Pro',
          'Jusqu\'à 25 catégories personnalisées',
          'Règles sur-mesure',
          'Automatisation avancée',
          'Accompagnement dédié',
          'Support prioritaire',
        ],
        cta: 'Voir les détails du pack',
        featured: false,
      },
    ],
  },

  // How it works
  howItWorks: {
    title: 'Comment ça marche',
    setupTime: 'Délai de mise en place: 24–48h',
    steps: [
      {
        number: '1',
        title: 'On configure',
        description: '15 min',
        icon: 'Cog',
      },
      {
        number: '2',
        title: 'Toolia prépare',
        description: 'tri + brouillons + notifications',
        icon: 'Zap',
      },
      {
        number: '3',
        title: 'Vous validez',
        description: 'envoi/archivage',
        icon: 'Check',
      },
    ],
  },

  // Stats
  stats: {
    title: 'Des résultats concrets, dès les premières semaines',
    items: [
      {
        value: '5–10h',
        label: 'par semaine récupérées',
        icon: 'TrendingUp',
      },
      {
        value: '0',
        label: 'email important oublié',
        icon: 'Mail',
      },
      {
        value: '24–48h',
        label: 'pour être opérationnel',
        icon: 'Clock',
      },
      {
        value: '24/7',
        label: 'Support réactif',
        icon: 'Headphones',
      },
    ],
  },

  // FAQ
  faq: {
    title: 'Questions fréquentes',
    items: [
      {
        question: 'Toolia peut-elle répondre et envoyer des emails à ma place ?',
        answer: 'Oui, si vous le souhaitez. Deux modes : validation avant envoi (vous gardez le contrôle) ou envoi automatique sur des cas simples (ex: confirmations, relances, infos récurrentes). On choisit ensemble ce qui est automatique et ce qui reste à valider.',
      },
      {
        question: 'Est-ce que ça change mes habitudes ?',
        answer: 'Non, ça ne change pas vos habitudes. Vous continuez à travailler comme avant, mais Toolia gère le tri et les tâches répétitives, ce qui booste vraiment votre efficacité.',
      },
      {
        question: 'Combien de temps pour que Toolia soit opérationnelle ?',
        answer: 'En général 24 à 48h. On met en place le tri, les règles et les réponses types, puis on ajuste selon vos retours.',
      },
      {
        question: 'Confidentialité : comment sont protégées mes données ?',
        answer: 'Vos données sont traitées avec une approche responsable : minimisation, accès limité et aucune revente. Vous gardez le contrôle et on peut définir exactement ce qui est utilisé (ou non).',
      },
      {
        question: 'Est-ce personnalisable à mon activité ?',
        answer: 'Oui. Toolia s\'adapte à votre métier : catégories, règles, labels, ton des réponses et scénarios. Tout est configuré sur mesure selon vos besoins.',
      },
      {
        question: 'Comment ça démarre concrètement ?',
        answer: 'On fait un appel court (15–20 min) pour comprendre votre besoin. Ensuite, on configure Toolia et vous recevez une première version sous 24–48h. On ajuste ensuite avec vos retours.',
      },
    ],
  },

  // Contact Form
  contact: {
    title: 'Booster mon efficacité',
    subtitle: 'Laissez vos infos, on vous recontacte rapidement',
    benefits: [
      'Gain de temps immédiat',
      'Contrôle total maintenu',
      'Confidentialité garantie',
    ],
    form: {
      nameLabel: 'Nom',
      namePlaceholder: 'Votre nom',
      emailLabel: 'Email pro',
      emailPlaceholder: 'vous@entreprise.com',
      volumeLabel: 'Volume d\'emails/jour',
      volumeOptions: [
        { value: '<20', label: 'Moins de 20' },
        { value: '20-50', label: '20 à 50' },
        { value: '50-100', label: '50 à 100' },
        { value: '100+', label: '100+' },
      ],
      messageLabel: 'Message (optionnel)',
      messagePlaceholder: 'Dites-en plus sur votre projet...',
      checkboxLabel: 'J\'accepte d\'être recontacté',
      submitBtn: 'Lancer l\'automatisation',
      loadingBtn: 'Envoi…',
      successMessage: 'Demande envoyée. On revient vers vous rapidement.',
      errorMessage: 'Une erreur est survenue. Veuillez réessayer.',
    },
  },

  // Testimonials
  testimonials: {
    title: 'Déjà plus de 200 boîtes mail optimisées.',
    items: [
      {
        quote: 'Toolia a réduit nos emails de 70%. Je gagne 2h chaque jour.',
        author: 'Margot B.',
        role: 'Directrice générale',
        company: 'Startup SaaS',
        avatar: 'MB',
      },
      {
        quote: 'Zéro perte d\'emails importants et un vrai gain de temps.',
        author: 'Pierre Lefevre',
        role: 'Responsable commercial',
        company: 'PME Tech',
        avatar: 'PL',
      },
      {
        quote: 'La meilleure IA mail du marché. Configurée en 48h.',
        author: 'Sophie Martin',
        role: 'Directrice',
        company: 'Agence de consulting',
        avatar: 'SM',
      },
    ],
  },

  // Footer
  footer: {
    copyright: '© Toolia — Tous droits réservés',
    links: [
      { label: 'Produit', href: '#product' },
      { label: 'Offres', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Contact', href: '#contact' },
      { label: 'Politique de confidentialité', href: '#privacy' },
    ],
  },
}
