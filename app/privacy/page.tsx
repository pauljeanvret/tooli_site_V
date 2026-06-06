import Link from 'next/link'

const contactEmail = 'tooliadev@gmail.com'

const sections = [
  {
    title: 'Données utilisées pour fournir Toolia',
    body: 'Toolia utilise les données nécessaires au fonctionnement du service : compte utilisateur, configuration de vos catégories, statut de facturation, connexion Gmail, connexion Telegram si vous l’activez, usage mensuel et logs techniques utiles au suivi du service.',
  },
  {
    title: 'Connexion Gmail par Google OAuth',
    body: 'Toolia se connecte à Gmail via Google OAuth. Toolia ne vous demande jamais votre mot de passe Gmail. Vous choisissez les autorisations accordées et vous pouvez révoquer l’accès depuis votre compte Google à tout moment.',
  },
  {
    title: 'Utilisation des emails',
    body: 'Selon votre configuration, Toolia peut accéder à des métadonnées ou à du contenu d’emails uniquement pour classer les messages, créer ou vérifier des labels Gmail, préparer des brouillons, comprendre un fil de discussion ou déclencher une alerte. Toolia ne vend pas vos données email, ne les utilise pas pour de la publicité et les utilise uniquement pour fournir le service.',
  },
  {
    title: 'Brouillons et envoi',
    body: 'Toolia peut créer des brouillons dans Gmail. Par défaut, Toolia n’envoie pas automatiquement vos emails : vous gardez la validation finale dans Gmail avant tout envoi.',
  },
  {
    title: 'Suppression et archivage',
    body: 'Toolia ne supprime pas définitivement vos emails. Certaines actions peuvent classer, labelliser ou préparer des traitements selon vos règles, mais la suppression définitive n’est pas une action prévue par le service.',
  },
  {
    title: 'IA et contexte utile',
    body: 'Pour classifier un email, préparer un brouillon ou résumer votre style d’écriture, Toolia peut transmettre à un fournisseur IA des extraits ou éléments de contexte utiles. Cette utilisation sert uniquement à fournir le service demandé.',
  },
  {
    title: 'Stripe et facturation',
    body: 'La facturation est gérée par Stripe. Toolia ne stocke pas vos numéros de carte bancaire. Les changements d’offre, annulations et moyens de paiement sont gérés dans le portail sécurisé Stripe.',
  },
  {
    title: 'Telegram',
    body: 'Telegram est optionnel. Si vous l’activez, Toolia l’utilise uniquement pour envoyer les alertes prévues par votre configuration et votre offre.',
  },
  {
    title: 'Vos droits',
    body: `Vous pouvez demander l’accès, la correction ou la suppression de vos données Toolia en écrivant à ${contactEmail}. Vous pouvez aussi révoquer l’accès Google depuis votre compte Google.`,
  },
]

export default function PrivacyPage() {
  return (
    <section className="min-h-[calc(100vh-72px)] bg-gradient-to-b from-toolia-bg-main via-toolia-bg-main to-toolia-bg-secondary/70 px-6 py-16 md:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-toolia-info">Confidentialité</p>
        <h1 className="text-3xl font-bold text-toolia-text md:text-5xl">Politique de confidentialité</h1>
        <p className="mt-5 max-w-3xl text-sm leading-7 text-toolia-text-secondary">
          Cette page explique comment Toolia utilise les données nécessaires à l’automatisation Gmail, aux brouillons, aux alertes et à la facturation.
        </p>

        <div className="mt-10 space-y-6">
          {sections.map((section) => (
            <article key={section.title} className="rounded-card border border-toolia-border-subtle bg-toolia-card p-6">
              <h2 className="text-xl font-semibold text-toolia-text">{section.title}</h2>
              <p className="mt-3 text-sm leading-7 text-toolia-text-secondary">{section.body}</p>
            </article>
          ))}
        </div>

        <div className="mt-10 rounded-card border border-toolia-border-subtle bg-toolia-card-hover p-6 text-sm leading-7 text-toolia-text-secondary">
          Contact confidentialité : <span className="font-semibold text-toolia-text">{contactEmail}</span>
        </div>

        <Link href="/" className="mt-8 inline-flex text-sm font-semibold text-toolia-text underline underline-offset-4">
          Retour à l’accueil
        </Link>
      </div>
    </section>
  )
}
