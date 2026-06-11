// Centralized copy for the public site.
export const copy = {
  navbar: {
    logo: 'Toolia',
    nav: [
      { label: 'Produit', href: '#product' },
      { label: 'Offres', href: '#pricing' },
      { label: 'Comment ça marche', href: '#how' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Contact', href: '#contact' },
    ],
    cta: 'Automatiser ma boîte Gmail',
  },

  hero: {
    title: 'Votre boîte mail se gère toute seule.',
    subtitle:
      'Toolia trie, priorise et prépare vos réponses dans Gmail. Vous gardez la main, Toolia s’occupe du répétitif.',
    proofs: [
      'Configuration en quelques minutes',
      'Brouillons à valider',
      'Contrôle total',
    ],
    cta1: 'Automatiser ma boîte Gmail',
    cta2: 'Voir comment ça marche',
    subCta: 'Sans engagement • Vous gardez le contrôle',
    mockupTitle: 'Inbox',
    mockupEmails: [
      { from: 'Sarah Martin', subject: 'Présentation SaaS', tag: 'Urgent' },
      { from: 'Jean Dupont', subject: 'Contrat à signer', tag: 'À traiter' },
      { from: 'Newsletter', subject: 'Votre digest hebdo', tag: 'À archiver' },
    ],
    draftReady: 'Brouillon prêt',
    timeSaved: 'Temps économisé aujourd’hui : 42 min',
  },

  values: {
    title: 'Conçu pour vous faire gagner du temps sans perdre le contrôle.',
    items: [
      {
        title: 'Tri automatique',
        description: 'Labels Gmail, priorités et actions appliqués selon vos règles.',
        icon: 'Zap',
      },
      {
        title: 'Validation finale',
        description: 'Les brouillons restent dans Gmail. Vous décidez de l’envoi.',
        icon: 'Shield',
      },
      {
        title: 'Données maîtrisées',
        description: 'Connexion Google OAuth, minimisation des données et accès révocable.',
        icon: 'Lock',
      },
    ],
  },

  pricing: {
    title: 'Choisissez l’offre adaptée à votre volume Gmail.',
    disclaimer:
      'Après le choix de l’offre, vous créez votre compte, connectez Gmail, puis configurez vos règles depuis le dashboard.',
    plans: [
      {
        name: 'Starter',
        description: 'Pour démarrer avec une automatisation Gmail simple et maîtrisée.',
        setup: '49€',
        setupLabel: 'Mise en place',
        price: '29€',
        period: '/mois',
        features: [
          '5 labels Gmail',
          '1 500 emails traités par mois',
          '100 brouillons IA par mois',
          '1 analyse de style par mois',
          'Traitement automatique toutes les 30 min minimum',
          'Telegram non inclus',
          'Support standard',
        ],
        cta: 'Voir les détails du pack',
        featured: false,
      },
      {
        name: 'Pro',
        description: 'Pour indépendants et petites équipes qui vivent dans Gmail.',
        setup: '99€',
        setupLabel: 'Mise en place',
        price: '69€',
        period: '/mois',
        features: [
          '12 labels Gmail',
          '4 000 emails traités par mois',
          '400 brouillons IA par mois',
          'Alertes Telegram par catégorie',
          '2 analyses de style par mois',
          'Traitement automatique toutes les 10 min minimum',
          'Support prioritaire',
        ],
        cta: 'Voir les détails du pack',
        featured: true,
      },
      {
        name: 'Premium',
        description: 'Pour volumes plus élevés et besoin de suivi plus rapide.',
        setup: '199€',
        setupLabel: 'Mise en place',
        price: '129€',
        period: '/mois',
        features: [
          '25 catégories personnalisées',
          '10 000 emails traités par mois',
          '1 200 brouillons IA par mois',
          'Telegram avancé',
          '4 analyses de style par mois',
          'Traitement automatique toutes les 5 min minimum',
          'Support prioritaire',
        ],
        cta: 'Voir les détails du pack',
        featured: false,
      },
    ],
  },

  howItWorks: {
    title: 'Comment ça marche',
    setupTime: 'Mise en place en 15 minutes',
    steps: [
      {
        number: '1',
        title: 'Connectez Gmail',
        description:
          'Vous connectez votre boîte Gmail en quelques clics. Toolia ne demande jamais votre mot de passe.',
        icon: 'Cog',
      },
      {
        number: '2',
        title: 'Choisissez vos règles',
        description:
          'Définissez vos catégories, vos labels, les alertes Telegram et les brouillons à préparer.',
        icon: 'Zap',
      },
      {
        number: '3',
        title: 'Toolia travaille en arrière-plan',
        description:
          'Les emails sont traités automatiquement selon votre offre : 30 min, 10 min ou 5 min minimum.',
        icon: 'Zap',
      },
      {
        number: '4',
        title: 'Vous validez',
        description:
          'Les brouillons restent dans Gmail. Rien n’est envoyé automatiquement sans votre validation.',
        icon: 'Check',
      },
    ],
  },

  stats: {
    title: 'Des repères concrets pour reprendre le contrôle de Gmail',
    items: [
      {
        value: 'Jusqu’à 5–10h',
        label: 'récupérées par semaine selon le volume',
        icon: 'TrendingUp',
      },
      {
        value: 'Priorités',
        label: 'moins d’emails importants oubliés',
        icon: 'Mail',
      },
      {
        value: '15 min',
        label: 'pour configurer les premières règles',
        icon: 'Clock',
      },
      {
        value: 'Continu',
        label: 'automatisation en arrière-plan selon votre offre',
        icon: 'Headphones',
      },
    ],
  },

  faq: {
    title: 'Questions fréquentes',
    items: [
      {
        question: 'Est-ce que Toolia envoie des emails à ma place ?',
        answer:
          'Non. Toolia prépare des brouillons dans Gmail, mais vous gardez la validation finale. L’envoi automatique n’est pas activé par défaut.',
      },
      {
        question: 'Est-ce que Toolia lit tous mes emails ?',
        answer:
          'Toolia analyse les emails nécessaires au tri, aux labels, aux brouillons et aux alertes. L’objectif est de minimiser les données utilisées.',
      },
      {
        question: 'Est-ce que je dois donner mon mot de passe Gmail ?',
        answer:
          'Non. La connexion se fait via Google OAuth. Vous pouvez révoquer l’accès depuis votre compte Google à tout moment.',
      },
      {
        question: 'Combien de temps faut-il pour commencer ?',
        answer:
          'La configuration peut se faire en quelques minutes : compte, offre, connexion Gmail, catégories et activation.',
      },
      {
        question: 'À quelle fréquence mes emails sont-ils traités ?',
        answer:
          'Selon votre offre : Starter toutes les 30 minutes minimum, Pro toutes les 10 minutes minimum, Premium toutes les 5 minutes minimum.',
      },
      {
        question: 'Est-ce que mes emails sont supprimés ?',
        answer:
          'Non. Toolia ne supprime jamais définitivement vos emails. La V1 se concentre sur le tri, les labels, les brouillons et les alertes.',
      },
      {
        question: 'Puis-je arrêter l’abonnement ?',
        answer:
          'Oui. Vous pouvez gérer votre abonnement depuis l’espace de facturation sécurisé Stripe.',
      },
      {
        question: 'Telegram est-il inclus dans toutes les offres ?',
        answer:
          'Les alertes Telegram dépendent de l’offre. Starter ne les inclut pas, Pro et Premium donnent accès aux alertes plus avancées.',
      },
    ],
  },

  contact: {
    title: 'Contacter Toolia',
    subtitle:
      'Une question sur votre compte, la sécurité Gmail, la facturation ou une automatisation ? Envoyez un message.',
    benefits: [
      'Support compte et facturation',
      'Questions Gmail et sécurité',
      'Aide configuration Toolia',
    ],
    form: {
      nameLabel: 'Nom',
      namePlaceholder: 'Votre nom',
      emailLabel: 'Email professionnel',
      emailPlaceholder: 'vous@entreprise.com',
      subjectLabel: 'Sujet',
      subjectPlaceholder: 'Exemple : question sur Gmail, facturation, configuration...',
      messageLabel: 'Message',
      messagePlaceholder: 'Expliquez votre demande en quelques lignes.',
      checkboxLabel: 'J’accepte d’être recontacté au sujet de ma demande',
      submitBtn: 'Envoyer le message',
      loadingBtn: 'Envoi…',
      successMessage: 'Message envoyé. Nous reviendrons vers vous dès que possible.',
      errorMessage: 'Une erreur est survenue. Veuillez réessayer.',
    },
  },

  testimonials: {
    title: 'Un outil pensé pour les boîtes Gmail professionnelles.',
    items: [
      {
        quote: 'Toolia m’aide à retrouver les bons emails plus vite et à préparer mes réponses.',
        name: 'Margot B.',
        role: 'Dirigeante',
        initials: 'MB',
      },
      {
        quote: 'Les labels et les brouillons me donnent une boîte de réception beaucoup plus lisible.',
        name: 'Pierre L.',
        role: 'Responsable commercial',
        initials: 'PL',
      },
      {
        quote: 'Le plus important : je garde la main avant chaque envoi.',
        name: 'Sophie M.',
        role: 'Consultante',
        initials: 'SM',
      },
    ],
  },

  footer: {
    copyright: '© Toolia — Tous droits réservés',
    links: [
      { label: 'Produit', href: '#product' },
      { label: 'Offres', href: '#pricing' },
      { label: 'FAQ', href: '#faq' },
      { label: 'Contact', href: '#contact' },
      { label: 'Confidentialité', href: '/privacy' },
      { label: 'Conditions', href: '/terms' },
      { label: 'Mentions légales', href: '/legal' },
      { label: 'Support', href: '/support' },
    ],
  },
}
